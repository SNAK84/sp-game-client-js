<?php

@ini_set('date.timezone', 'Europe/Moscow');

error_reporting(E_ALL);
ini_set('display_errors', 1);

define('ROOT_DIR', str_replace('\\', '/', dirname(__FILE__)) . '/');


$StyleSheet = array('style', 'jquery-ui/jquery-ui.min', 'materialdesignicons.min');
$Themes = array('light' => 'css/theme-light.css', 'dark' => 'css/theme-dark.css');
$Theme = 'dark';

$JavaScripts = array(
    'jquery-3.7.1.min',
    'jquery-ui-1.14.1.min',
    'jquery.ui.touch-punch.fixed',
    'Dialog',
    'base',
    'tooltip',
    'websocket',
    'LangManager',
    'BasePageClass',
    'GameBuildElement',
    'IconSelector'
);
$PagesDir = 'js/pages/';
$Pages = array(
    'login' => 'LoginPageClass',
    'overview' => 'OverViewPageClass',
    'buildings' => 'BuildsPageClass',
    'researchs' => 'ResearchsPageClass',
    'shipyard' => 'HangarPageClass',
    'defense' => 'HangarPageClass',
    'galaxy' => 'GalaxyPageClass',
    'fleets' => 'FleetsPageClass',
    'messages' => 'MessagesPageClass',
);

$LangsDir = 'lang/';
$Langs = array(
    'ru'
);

$AjaxArray = [];



$tpl = <<<HTML
    <overlay show="true" style="transition:opacity300msease0s;opacity:0.75;"></overlay>

    <div id="ping-indicator">Ping: ...</div>

    <div id="MenuBtn" class="menu_toggle_btn ResBox" style="display:none">
        <div class="menu_toggle"><i></i><i></i><i></i></div>
        Меню
    </div>
    
    <div id="layer" style="display:none"></div>


        <div id="LeftMenu" class="box" style="display:none">
            <div id="PlanetsList" class="PlanetsList">0000</div>
            <div id="menu">Основное</div>
            <div id="submenu">
                <div mode="overview">Обзор</div>
                <div mode="fleets">Флот</div>
                <div mode="galaxy">Галактика</div>
                <div mode="imperium">Империя</div>
            </div>
            <div id="menu">Развитие</div>
            <div id="submenu">
                <div mode="buildings">Постройки</div>
                <div mode="researchs">Исследования</div>
                <div mode="shipyard">Верфь</div>
                <div mode="defense">Оборона</div>
                <div mode="arts">Артефакты</div>
            </div>
            <div id="menu">Экономика</div>
            <div id="submenu">
                <div mode="resources">Производство</div>
            </div>
            <div id="menu">Обсерватория</div>
            <div id="submenu">
                <div mode="messages">Сообщения</div>
                <div mode="chat">Чат</div>
                <div mode="ally">Альянс</div>
                <div mode="treetech">Технологии</div>
            </div>
            <div id="menu">&nbsp;</div>
            <div id="submenu">
                <div mode="logout" class="btn-danger">Выход</div>
            </div>
        </div>


    <div id="bottom_panel">
        <span id="copyright"> Проект «Космические пираты v2.0.alfa». Все права защищены.</span>
    </div>

HTML;

function AddAjax($key, $value)
{
    global $AjaxArray;

    $AjaxArray[$key] = $value;
}

function getFileVersion($filepath)
{
    return file_exists($filepath) ? substr(md5_file($filepath), 0, 8) : '1';
}

function GetCss()
{
    global $StyleSheet, $Theme;
    $result = "";
    foreach ($StyleSheet as $Script) {
        $filepath = ROOT_DIR . 'css/' . $Script . '.css';
        if (file_exists($filepath)) {
            $result .= "\t<link rel='stylesheet' type='text/css' href='/css/" . $Script . '.css?v=' . getFileVersion($filepath) . "'>\n";
        }
    }

    $filepath = ROOT_DIR . 'css/theme-' . $Theme . '.css';
    if (file_exists($filepath)) {
        $result .= "\t<link rel='stylesheet' type='text/css' id='theme-link' href='/css/theme-" . $Theme . '.css?v=' . getFileVersion($filepath) . "'>\n";
    }
    return $result;
}

function GetScript()
{
    global $JavaScripts;
    $result = "";
    foreach ($JavaScripts as $Script) {
        $filepath = ROOT_DIR . 'js/' . $Script . '.js';
        if (file_exists($filepath)) {
            $result .= "\t<script type='text/javascript' src='/js/" . $Script . '.js?v=' .  getFileVersion($filepath) . "'></script>\n";
        }
    }
    return $result;
}

function SetAjaxThemeLink()
{
    global $Themes;

    $result = array();
    foreach ($Themes as $key => $Script) {
        $filepath = ROOT_DIR . $Script;
        if (file_exists($filepath)) {
            $result[$key] = $Script . '?v=' . getFileVersion($filepath);
        }
    }

    AddAjax('ThemesLink', $result);
}

function SetAjaxPagesLink()
{
    global $Pages, $PagesDir;

    $result = array();
    $deb_result = array();
    $pageMap = [];
    foreach ($Pages as $key => $Script) {
        $filepath = ROOT_DIR . $PagesDir . $Script . '.js';
        if (file_exists($filepath)) {
            $result[$key] = $PagesDir . $Script . '.js?v=' . getFileVersion($filepath);
            $pageMap[$key] = $Script;
        }
        $deb_result[$key] = $filepath . ' ' . file_exists($filepath);
    }

    AddAjax('pageMap', $pageMap);
    AddAjax('PagesLink', $result);
    AddAjax('PagesLinkDebug', $deb_result);
}

function SetAjaxLangsLink()
{
    global $Langs, $LangsDir;

    $result = array();
    $deb_result = array();
    foreach ($Langs as $key => $Script) {
        $filepath = ROOT_DIR . $LangsDir . $Script . '.json';
        if (file_exists($filepath)) {
            $result[$Script] = $LangsDir . $Script . '.json?v=' . getFileVersion($filepath);
        }
        $deb_result[$Script] = $filepath . ' ' . file_exists($filepath);
    }

    AddAjax('LangsLink', $result);
    AddAjax('PagesLinkDebug', $deb_result);
}

function GetAjaxArray()
{
    global $AjaxArray;

    $result = "\t<script type='text/javascript'>\n";
    foreach ($AjaxArray as $k => $j) {
        $result .= "\t\t var " . $k . " = " . json_encode($j) . ";\n";
    }
    return $result . "</script>\n";
}

function GetHeads()
{

    global $Config;

    $Header = "<head>
    <link rel='apple-touch-icon' sizes='57x57' href='/images/icon/apple-icon-57x57.png'>
    <link rel='apple-touch-icon' sizes='60x60' href='/images/icon/apple-icon-60x60.png'>
    <link rel='apple-touch-icon' sizes='72x72' href='/images/icon/apple-icon-72x72.png'>
    <link rel='apple-touch-icon' sizes='76x76' href='/images/icon/apple-icon-76x76.png'>
    <link rel='apple-touch-icon' sizes='114x114' href='/images/icon/apple-icon-114x114.png'>
    <link rel='apple-touch-icon' sizes='120x120' href='/images/icon/apple-icon-120x120.png'>
    <link rel='apple-touch-icon' sizes='144x144' href='/images/icon/apple-icon-144x144.png'>
    <link rel='apple-touch-icon' sizes='152x152' href='/images/icon/apple-icon-152x152.png'>
    <link rel='apple-touch-icon' sizes='180x180' href='/images/icon/apple-icon-180x180.png'>
    <link rel='icon' type='image/png' sizes='192x192'  href='/images/icon/android-icon-192x192.png'>
    <link rel='icon' type='image/png' sizes='32x32' href='/images/icon/favicon-32x32.png'>
    <link rel='icon' type='image/png' sizes='96x96' href='/images/icon/favicon-96x96.png'>
    <link rel='icon' type='image/png' sizes='16x16' href='/images/icon/favicon-16x16.png'>
    <meta name='msapplication-TileColor' content='#464646'>
    <meta name='msapplication-TileImage' content='/images/icon/ms-icon-144x144.png'>
    <meta name='theme-color' content='#464646'>

    <title>Космические пираты</title>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <meta http-equiv='content-type' content='text/html; charset=UTF-8'>

    <meta name='description' content='' />
    <meta name='keywords' content='' />
    <meta name='robots' content='all' />
    <meta name='revisit-after' content='1 days' />
";
    $Header .= GetCss();
    $Header .= GetScript();
    //   $Header .= "\t<script src='https://www.google.com/recaptcha/api.js?render=" . $config['recaptcha_public_key'] . "'></script>\n";
    SetAjaxThemeLink();
    SetAjaxPagesLink();
    SetAjaxLangsLink();
    $Header .= GetAjaxArray();

    $Header .= "</head>\n<body>\n";

    return $Header;
}


$Page = "<!DOCTYPE html>\n<html lang=\"ru\">\n";
$Page .= GetHeads();
$Page .= $tpl;
$Page .= "</body>\n</html>\n";

echo $Page;
