const Applet = imports.ui.applet;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

class MouseTouchpadToggle extends Applet.IconApplet{
    constructor(metadata, orientation, panelHeight, instanceId){
        super(orientation, panelHeight, instanceId);

        this.mouse_xinput_id = 9
        this.touchpad_xinput_id = 22

        this.MTG_modes = [
            "both",
            // "mouse",
            "touchpad"
        ]
        this.MTG_mode = this.MTG_modes[0]
        this.MTG_apply()

        this.set_applet_icon_name(this.MTG_getIconName())
        this._applet_icon.set_icon_size(20)
    }

    MTG_getIconName() {

        if(this.MTG_mode == "touchpad")
            return "input-touchpad-symbolic"
        else //if(this.MTG_mode == "mouse")
            return "input-mouse-symbolic"
        // else // both
            // return "preferences-desktop-peripherals-symbolic"
    }

    MTG_setTouchpadState(activated)
    {
        GLib.spawn_command_line_async(`xinput set-prop ${this.touchpad_xinput_id} "Device Enabled" ${activated ? "1" : "0"}`);
    }

    MTG_setMouseState(activated)
    {
        GLib.spawn_command_line_async(`xinput set-prop ${this.mouse_xinput_id} "Device Enabled" ${activated ? "1" : "0"}`);
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
        this.set_applet_icon_name(this.MTG_getIconName())
        this._applet_icon.set_icon_size(20)
        this.MTG_apply()
    }

    on_applet_removed_from_panel() {
        //cleanup : restore default functionnality
        this.MTG_setTouchpadState(true)
        this.MTG_setMouseState(true)
    }
}

function main(metadata, orientation, panelHeight, instanceId) { // Define the main function receiving the standard parameters sent during the instantiation of the applet to the panel
    return new MouseTouchpadToggle(metadata, orientation, panelHeight, instanceId); // Return a new instance of our applet
}
