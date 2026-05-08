const Applet = imports.ui.applet;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;

class MouseTouchpadToggle extends Applet.IconApplet{
    constructor(metadata, orientation, panelHeight, instanceId){
        super(orientation, panelHeight, instanceId);

        const seat = Clutter.get_default_backend().get_default_seat();
        this._deviceAddedId = seat.connect('device-added', (seat, device) => {
            global.log("Device added: " + device.get_device_name());
            this.MTG_updateStatus();
        });
        this._deviceRemovedId = seat.connect('device-removed', (seat, device) => {
            global.log("Device removed: " + device.get_device_name());
            this.MTG_updateStatus();
        });

        global.log("updating status ...");

        this.MTG_updateStatus()
    }

    MTG_updateStatus()
    {
        const [mouse,touchpad] = this.MTG_identifyDevices("Logitech Wireless Mouse")

        if(mouse=== undefined || touchpad == undefined)
        {
            this.set_applet_icon_name("mouse-wireless-disabled-symbolic")
            this._applet_icon.set_icon_size(20)
            this.set_applet_tooltip("No mouse connected")
            this.MTG_setTouchpadState(true)
        }
        else{
            this.MTG_mouse_xinput_id = mouse
            this.MTG_touchpad_xinput_id = touchpad

            this.MTG_modes = [
                // "both",
                "mouse",
                "touchpad"
            ]
            this.MTG_mode = this.MTG_modes[0]
            this.MTG_apply()
            
            const {
                icon,
                tootlip
            } = this.MTG_getDisplayInfo()

            this.set_applet_icon_name(icon)
            this._applet_icon.set_icon_size(20)
            this.set_applet_tooltip(tootlip)
        }
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

    MTG_identifyDevices(mouse_name)
    {
        // Main.notify("MTG report","about to exec ...");
        const match_mouse_line = new RegExp(`${mouse_name}`)
        const match_touchpad_line = new RegExp(`Touchpad`)

        const [ok, standard_output, standard_error, exit_status] = GLib.spawn_command_line_sync(`xinput list`)
        var matched_mouse_ids = []
        var matched_touchpad_ids = []
        if(ok)
        {
            const xinput_lines = new TextDecoder().decode(standard_output);
            //mouse

            const pointer_section = xinput_lines.split('Virtual core keyboard')[0];
            const lines = pointer_section.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i];
                if(match_mouse_line.test(l))
                {
                    const id = /id=(\d+)/.exec(l)[1];
                    matched_mouse_ids.push(id)
                }
            }
            //touchpad
            const touchpad_lines = xinput_lines.split('\n');

            for (let i = 0; i < touchpad_lines.length; i++) {
                const l = touchpad_lines[i];
                if(match_touchpad_line.test(l))
                {
                    const id = /id=(\d+)/.exec(l)[1];
                    matched_touchpad_ids.push(id)
                }
            }
        }

        var mouse_id = undefined
        var touchpad_id = undefined
        if(matched_mouse_ids.length == 1)
        {
            mouse_id = matched_mouse_ids[0]
        }
        if(matched_touchpad_ids.length == 1)
        {
            touchpad_id = matched_touchpad_ids[0]
        }
        return [mouse_id,touchpad_id]
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
        //cycling
        this.MTG_mode = this.MTG_modes[(this.MTG_modes.indexOf(this.MTG_mode) + 1) % this.MTG_modes.length]
        this.MTG_updateStatus()
    }

    on_applet_removed_from_panel() {
        //cleanup : restore default functionnality
        this.MTG_setTouchpadState(true)
        this.MTG_setMouseState(true)

        //disconnect from clutter backend
        const seat = Clutter.get_default_backend().get_default_seat();
        seat.disconnect(this._deviceAddedId);
        seat.disconnect(this._deviceRemovedId);
    }
}

function main(metadata, orientation, panelHeight, instanceId) { // Define the main function receiving the standard parameters sent during the instantiation of the applet to the panel
    return new MouseTouchpadToggle(metadata, orientation, panelHeight, instanceId); // Return a new instance of our applet
}
