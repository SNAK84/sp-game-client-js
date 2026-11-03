"""Неподвижный AI-рисунок + детерминированные световые эффекты, без дрожания.

Зависимости: Pillow, numpy. Программная анимация согласована с пользователем.
Логистика: один рисунок и свет. Радар: чистая основа из 16 исходных кадров
и отдельная вращающаяся световая фактура первоначального шлейфа.
Окружение обоих объектов зафиксировано во всех кадрах.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "images" / "techs"
MANIFEST = ROOT / "sources" / "animations.json"


def source_image(spec, index=None):
    atlas = Image.open(ROOT / "sources" / spec["atlas"]).convert("RGB")
    columns, rows = spec["columns"], spec["rows"]

    def frame(index):
        x, y = index % columns, index // columns
        image = atlas.crop((round(x * atlas.width / columns), round(y * atlas.height / rows),
                            round((x + 1) * atlas.width / columns), round((y + 1) * atlas.height / rows)))
        return np.asarray(image.resize((480, 480), Image.Resampling.LANCZOS), dtype=np.float32)

    return frame(spec["sourceFrame"] if index is None else index)


def radar_frames(spec, count):
    images = np.stack([source_image(spec, i) for i in range(16)])
    reference = images[spec["sourceFrame"]]
    y, x = np.indices(reference.shape[:2], dtype=np.float32)
    x, y = x / 480, y / 480
    radius = np.hypot((x - .495) / .265, (y - .383) / .263)
    mask = np.clip((1.08 - radius) * 16, 0, 1)[..., None]
    # Низкий временной перцентиль восстанавливает сферу без проходящего луча.
    # Окружение берётся из одного кадра, а не усредняется/двигается.
    clean = reference + (np.percentile(images, 25, axis=0) - reference) * mask
    r, g, b = clean[..., 0], clean[..., 1], clean[..., 2]
    contacts = (r > 100) & (g > 145) & (b > 170) & (r > g * .72) & (radius < .92)
    signal_image = Image.fromarray(contacts.astype(np.uint8) * 255)
    signal_mask = np.asarray(signal_image.filter(ImageFilter.MaxFilter(5))) > 0
    contact_mask = np.asarray(signal_image.filter(ImageFilter.MaxFilter(17))) > 0
    empty = clean.copy()
    median = np.asarray(Image.fromarray(clean.astype(np.uint8)).filter(ImageFilter.MedianFilter(15)))
    empty[contact_mask] = median[contact_mask]
    # Гармоническое заполнение убирает остаточное свечение меток, а не размывает
    # их в голубые пятна. Граница и всё остальное изображение остаются исходными.
    yy, xx = np.where(contact_mask)
    for _ in range(400):
        empty[yy, xx] = (empty[yy - 1, xx] + empty[yy + 1, xx]
                         + empty[yy, xx - 1] + empty[yy, xx + 1]) * .25
    Image.fromarray(np.clip(empty, 0, 255).astype(np.uint8)).save(ROOT / "sources" / "computer_tech-empty.png")

    # Световая фактура — разность настоящего шлейфа из кадра 2 и clean plate.
    # Никакой новой плоской заливки: сохраняются цвет, плотность и радиальный градиент.
    light = np.clip(reference - clean, 0, 255)
    angle = np.arctan2((x - .495) / .265, -(y - .383) / .263)
    source_angle = math.radians(59)
    age = (source_angle - angle + math.pi) % (2 * math.pi) - math.pi
    # Остатки исходной сетки за хвостом не должны образовывать второй сектор.
    # Плотная часть шлейфа сохранена, последние 30° плавно затухают до нуля.
    fade = np.clip((math.pi / 2 - age) / math.radians(30), 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    # За ободком сферы в разность кадров попадает свечение окна/планеты.
    # Его нельзя вращать: иначе вслед за лучом снаружи появляется обрывок.
    screen = np.clip((1 - radius) * 32, 0, 1)
    sector = (age > -.15) & (age < math.pi / 2) & (radius < 1)
    light *= sector[..., None]
    smooth = np.asarray(Image.fromarray(light.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)))
    light[signal_mask] = smooth[signal_mask]
    # Повторная маска после фильтра не даёт свечению вытечь за границу хвоста.
    light *= (sector * fade * screen)[..., None]
    light_image = Image.fromarray(light.astype(np.uint8))

    # Метки берём из clean plate, а не из кадра с лучом: иначе вместе с ними
    # каждый кадр возвращаются неподвижные обрывки первоначального шлейфа.
    base = clean
    cx, cy, rx, ry = .495 * 480, .383 * 480, .265, .263
    lamp_groups = [(.06, .26, .60, .98), (.77, .95, .60, .98), (.40, .68, .75, .98)]
    cool = (reference[..., 1] > 90) & (reference[..., 2] > 115) & (reference[..., 2] > reference[..., 0] * 1.25)
    fixed = np.asarray(Image.fromarray(base.astype(np.uint8)).resize((120, 120), Image.Resampling.LANCZOS))
    sy, sx = np.indices((120, 120), dtype=np.float32)
    outside = np.square((sx / 120 - .495) / .29) + np.square((sy / 120 - .383) / .29) > 1
    for x1, x2, y1, y2 in lamp_groups:
        outside &= ~((sx / 120 > x1 - .02) & (sx / 120 < x2 + .02)
                     & (sy / 120 > y1 - .02) & (sy / 120 < y2 + .02))
    frames = []
    for i in range(count):
        phase = source_angle + 2 * math.pi * i / count
        rotation = phase - source_angle
        a, e = math.cos(rotation), math.cos(rotation)
        bb, d = (rx / ry) * math.sin(rotation), -(ry / rx) * math.sin(rotation)
        transform = (a, bb, cx - a * cx - bb * cy, d, e, cy - d * cx - e * cy)
        rotated = np.asarray(light_image.transform((480, 480), Image.Transform.AFFINE,
                             transform, resample=Image.Resampling.BICUBIC), dtype=np.float32)
        pixels = np.clip(base + rotated * screen[..., None], 0, 255)
        for j, (x1, x2, y1, y2) in enumerate(lamp_groups):
            lamps = cool & (x > x1) & (x < x2) & (y > y1) & (y < y2)
            pulse = .72 + .28 * (.5 + .5 * math.cos(2 * phase - j * 2 * math.pi / 3))
            pixels[lamps] = reference[lamps] * pulse
        pixels = pixels.astype(np.uint8)
        small = np.asarray(Image.fromarray(pixels).resize((120, 120), Image.Resampling.LANCZOS)).copy()
        # После downsample Lanczos не должен переносить меняющиеся пиксели
        # с края сферы на зафиксированный фон.
        small[outside] = fixed[outside]
        frames.append(Image.fromarray(small))
    return frames


def animate(base, effect, phase):
    y, x = np.indices(base.shape[:2], dtype=np.float32)
    x, y = x / 480, y / 480
    result = base.copy()
    if effect == "berths":
        # Только три световых узла. Ни один пиксель геометрии не сдвигается.
        r, g, b = base[..., 0], base[..., 1], base[..., 2]
        amber = (r > 80) & (g > 35) & (r > g * 1.06) & (r > b * 1.45)
        for i, (cx, cy, rx, ry) in enumerate([
            (.293, .405, .060, .063), (.714, .445, .065, .060), (.513, .560, .044, .060)
        ]):
            d = np.square((x - cx) / rx) + np.square((y - cy) / ry)
            pulse = (.5 + .5 * math.cos(phase - i * 2 * math.pi / 3)) ** 2
            emission = amber & (d < 1)
            result[emission] = np.clip(base[emission] * (.28 + 1.15 * pulse), 0, 255)
            halo = np.exp(-d * 5) * pulse * .22 * (d < 1)
            result += (np.array([255, 180, 60]) - result) * halo[..., None]
    else:
        raise ValueError("Неизвестный эффект: " + effect)
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).resize((120, 120), Image.Resampling.LANCZOS)


def build(name, spec):
    count, duration = spec["frameCount"], spec["duration"]
    assert count == 64 and duration == 30
    base = source_image(spec)
    rgb_frames = radar_frames(spec, count) if spec["effect"] == "radar" else [
        animate(base, spec["effect"], 2 * math.pi * i / count) for i in range(count)]
    # Общая палитра всех фаз исключает межкадровое мерцание неизменных цветов.
    sheet = Image.new("RGB", (120 * 8, 120 * 8))
    for i, frame in enumerate(rgb_frames):
        sheet.paste(frame, ((i % 8) * 120, (i // 8) * 120))
    palette = sheet.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    frames = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in rgb_frames]
    # Снаружи светового экрана/узлов декодированная картинка обязана быть одинаковой.
    y, x = np.indices((120, 120), dtype=np.float32)
    x, y = x / 120, y / 120
    if spec["effect"] == "radar":
        allowed = np.square((x - .495) / .29) + np.square((y - .383) / .29) <= 1
        for x1, x2, y1, y2 in [(.06, .26, .60, .98), (.77, .95, .60, .98), (.40, .68, .75, .98)]:
            allowed |= (x > x1 - .02) & (x < x2 + .02) & (y > y1 - .02) & (y < y2 + .02)
    else:
        allowed = np.zeros((120, 120), dtype=bool)
        for cx, cy in [(.293, .405), (.714, .445), (.513, .560)]:
            allowed |= (np.abs(x - cx) < .10) & (np.abs(y - cy) < .10)
    outside = ~allowed

    target = ROOT / (name + ".gif")
    temporary = target.with_suffix(".tmp.gif")
    frames[0].save(temporary, save_all=True, append_images=frames[1:], duration=duration,
                   loop=0, disposal=1, optimize=True)
    with Image.open(temporary) as result:
        assert result.size == (120, 120) and result.n_frames == count
        assert result.info["loop"] == 0
        first = np.asarray(result.convert("RGB"))
        unique = set()
        for i in range(count):
            result.seek(i)
            assert result.info["duration"] == duration
            pixels = np.asarray(result.convert("RGB"))
            assert np.array_equal(first[outside], pixels[outside]), "Дрожание вне светового эффекта"
            unique.add(pixels.tobytes())
        assert len(unique) == count
    temporary.replace(target)
    print(f"{name}: {count} уникальных кадров, {duration} мс/кадр, цикл {count * duration} мс; фон неподвижен")


if __name__ == "__main__":
    for name, spec in json.loads(MANIFEST.read_text()).items():
        build(name, spec)
