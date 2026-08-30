obs = obslua
source_name = "パワラジフォーマット"
hotkey_prev_id = obs.OBS_INVALID_HOTKEY_ID
hotkey_next_id = obs.OBS_INVALID_HOTKEY_ID
hotkey_scroll_up_id = obs.OBS_INVALID_HOTKEY_ID
hotkey_scroll_down_id = obs.OBS_INVALID_HOTKEY_ID
hotkey_scroll_top_id = obs.OBS_INVALID_HOTKEY_ID
function script_description() return [[パワラジフォーマット Browser Source をOBS側から直接操作します。
・前のお便り / 次のお便り
・本文を上へ / 下へスクロール
・本文の先頭へ戻る
管理画面の選択やスクロール位置はOBS Browser Sourceと別環境のため直接同期されません。このLuaホットキーを使えば、ウィンドウキャプチャに切り替えずBrowser Sourceのまま操作できます。]] end
function send_key(key_name) local source=obs.obs_get_source_by_name(source_name); if source==nil then obs.script_log(obs.LOG_WARNING,"パワラジフォーマット: Browser Source が見つかりません: "..source_name); return end; local event=obs.obs_key_event(); event.native_vkey=obs.obs_key_to_virtual_key(obs.obs_key_from_name(key_name)); event.modifiers=0; event.native_modifiers=0; event.native_scancode=0; event.text=""; obs.obs_source_send_focus(source,true); obs.obs_source_send_key_click(source,event,false); obs.obs_source_send_key_click(source,event,true); obs.obs_source_release(source) end
function previous_hotkey(pressed) if pressed then send_key("OBS_KEY_LEFT") end end
function next_hotkey(pressed) if pressed then send_key("OBS_KEY_RIGHT") end end
function scroll_up_hotkey(pressed) if pressed then send_key("OBS_KEY_UP") end end
function scroll_down_hotkey(pressed) if pressed then send_key("OBS_KEY_DOWN") end end
function scroll_top_hotkey(pressed) if pressed then send_key("OBS_KEY_HOME") end end
function script_properties() local props=obs.obs_properties_create(); obs.obs_properties_add_text(props,"source_name","Browser Source名",obs.OBS_TEXT_DEFAULT); return props end
function script_defaults(settings) obs.obs_data_set_default_string(settings,"source_name","パワラジフォーマット") end
function script_update(settings) source_name=obs.obs_data_get_string(settings,"source_name") end
function load_hotkey(settings,id,key) local array=obs.obs_data_get_array(settings,key); obs.obs_hotkey_load(id,array); obs.obs_data_array_release(array) end
function save_hotkey(settings,id,key) local array=obs.obs_hotkey_save(id); obs.obs_data_set_array(settings,key,array); obs.obs_data_array_release(array) end
function script_load(settings) hotkey_prev_id=obs.obs_hotkey_register_frontend("powaraji_previous","パワラジフォーマット: 前のお便り",previous_hotkey); hotkey_next_id=obs.obs_hotkey_register_frontend("powaraji_next","パワラジフォーマット: 次のお便り",next_hotkey); hotkey_scroll_up_id=obs.obs_hotkey_register_frontend("powaraji_scroll_up","パワラジフォーマット: 本文を上へ",scroll_up_hotkey); hotkey_scroll_down_id=obs.obs_hotkey_register_frontend("powaraji_scroll_down","パワラジフォーマット: 本文を下へ",scroll_down_hotkey); hotkey_scroll_top_id=obs.obs_hotkey_register_frontend("powaraji_scroll_top","パワラジフォーマット: 本文の先頭へ",scroll_top_hotkey); load_hotkey(settings,hotkey_prev_id,"powaraji_previous"); load_hotkey(settings,hotkey_next_id,"powaraji_next"); load_hotkey(settings,hotkey_scroll_up_id,"powaraji_scroll_up"); load_hotkey(settings,hotkey_scroll_down_id,"powaraji_scroll_down"); load_hotkey(settings,hotkey_scroll_top_id,"powaraji_scroll_top") end
function script_save(settings) save_hotkey(settings,hotkey_prev_id,"powaraji_previous"); save_hotkey(settings,hotkey_next_id,"powaraji_next"); save_hotkey(settings,hotkey_scroll_up_id,"powaraji_scroll_up"); save_hotkey(settings,hotkey_scroll_down_id,"powaraji_scroll_down"); save_hotkey(settings,hotkey_scroll_top_id,"powaraji_scroll_top") end