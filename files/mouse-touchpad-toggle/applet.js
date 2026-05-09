const Applet = imports.ui.applet;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GUdev = imports.gi.GUdev;

class MouseTouchpadToggle extends Applet.IconApplet{
    constructor(metadata, orientation, panelHeight, instanceId){
        super(orientation, panelHeight, instanceId);

        this.set_applet_icon_name("spinner-symbolic");
        this._applet_icon.set_icon_size(20);
        this.set_applet_tooltip("Loading Mouse Touchpad Toggle ...");

        this.MTG_modes = [
            // "both",
            "mouse",
            "touchpad"
        ]
        this.MTG_mode = this.MTG_modes[0]

        this._udevClient = new GUdev.Client({ subsystems: ['input'] });
        this._udevId = this._udevClient.connect('uevent', (client, action, device) => {
            global.log(`udev ${action}: ${device.get_name()}`);
            this.MTG_updateStatus();
        });

        global.log("updating status ...");

        this.MTG_updateStatus()
    }

    MTG_updateStatus() {
        this.MTG_identifyDevices("Logitech Wireless Mouse", (mouse, touchpad) => {
            if (mouse === undefined && this.MTG_mode == "mouse") {
                this.set_applet_icon_name("mouse-wireless-disabled-symbolic");
                this._applet_icon.set_icon_size(20);
                this.set_applet_tooltip("No mouse connected");
                this.MTG_setTouchpadState(true);
                this.toggleable = false;
            } else {
                this.MTG_mouse_xinput_id = mouse;
                this.MTG_touchpad_xinput_id = touchpad;
                this.MTG_apply();
                const { icon, tootlip } = this.MTG_getDisplayInfo();
                this.set_applet_icon_name(icon);
                this._applet_icon.set_icon_size(20);
                this.set_applet_tooltip(tootlip);
                this.toggleable = true;
            }
        });
    }

    MTG_getDisplayInfo() {

        if(this.MTG_mode == "touchpad")
            return {
                "icon":"input-touchpad-symbolic",
                "tootlip":"Switch to mouse"
            }
        else if(this.MTG_mode == "mouse")
            return {
                "icon":"input-mouse-symbolic",
                "tootlip":"Switch to touchpad"
            }
        // else // both
            // return "preferences-desktop-peripherals-symbolic"
    }

    MTG_setTouchpadState(activated)
    {
        if(!GLib.spawn_command_line_async(`xinput ${activated ? "--enable" : "--disable"} ${this.MTG_touchpad_xinput_id}`))
        {
            Main.notify("MTG error","Setting touchpad state has failed!");
        }
    }

    MTG_setMouseState(activated)
    {
        if(!GLib.spawn_command_line_async(`xinput ${activated ? "--enable" : "--disable"} ${this.MTG_mouse_xinput_id}`))
        {
            Main.notify("MTG error","Setting mouse state has failed!");
        }
    }

    MTG_identifyDevices(mouse_name, callback) {
        const match_mouse_line = new RegExp(mouse_name);
        const match_touchpad_line = new RegExp(`Touchpad`);

        try {
            const proc = new Gio.Subprocess({
                argv: ['xinput', 'list'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
            });
            proc.init(null);

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    const [, stdout] = proc.communicate_utf8_finish(res);
                    const [mouse_id, touchpad_id] = this.parseXinputOutput(stdout, match_mouse_line, match_touchpad_line);
                    callback(mouse_id, touchpad_id);
                } catch (e) {
                    global.logError(`MTG error reading xinput output: ${e}`);
                    callback(undefined, undefined);
                }
            });
        } catch (e) {
            global.logError(`MTG error spawning xinput: ${e}`);
            callback(undefined, undefined);
        }
    }

    parseXinputOutput(xinput_lines, match_mouse_line, match_touchpad_line) {
        let matched_mouse_ids = [];
        let matched_touchpad_ids = [];

        const pointer_section = xinput_lines.split('Virtual core keyboard')[0];
        for (const l of pointer_section.split('\n')) {
            if (match_mouse_line.test(l)) {
                const m = /id=(\d+)/.exec(l);
                if (m) matched_mouse_ids.push(m[1]);
            }
        }

        for (const l of xinput_lines.split('\n')) {
            if (match_touchpad_line.test(l)) {
                const m = /id=(\d+)/.exec(l);
                if (m) matched_touchpad_ids.push(m[1]);
            }
        }

        return [
            matched_mouse_ids.length === 1 ? matched_mouse_ids[0] : undefined,
            matched_touchpad_ids.length === 1 ? matched_touchpad_ids[0] : undefined
        ];
    }

    MTG_apply()
    {
        if(this.MTG_mode == "mouse"){
            this.MTG_setTouchpadState(false)
            this.MTG_setMouseState(true)
        }
        else if(this.MTG_mode == "touchpad"){
            this.MTG_setTouchpadState(true)
            this.MTG_setMouseState(false)
        }
        else // both
        {
            this.MTG_setTouchpadState(true)
            this.MTG_setMouseState(true)
        }
    }


    on_applet_clicked(){
        if(!this.toggleable)
        {
            Main.notify("MTG error","Could not toggle mouse and keyboard : no mouse connected.");
            return
        }
        global.log("Toggling...")
        //cycling
        this.MTG_mode = this.MTG_modes[(this.MTG_modes.indexOf(this.MTG_mode) + 1) % this.MTG_modes.length]
        this.MTG_updateStatus()
    }

    on_applet_removed_from_panel() {
        //cleanup : restore default functionnality
        this.MTG_setTouchpadState(true)
        this.MTG_setMouseState(true)

        //disconnect from backend
        this._udevClient.disconnect(this._udevId);
    }
}

function main(metadata, orientation, panelHeight, instanceId) { // Define the main function receiving the standard parameters sent during the instantiation of the applet to the panel
    return new MouseTouchpadToggle(metadata, orientation, panelHeight, instanceId); // Return a new instance of our applet
}
