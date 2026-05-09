const Applet = imports.ui.applet;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GUdev = imports.gi.GUdev;

class MTG_stateMachineState
{
    enter(stateMachine){}
    leave(stateMachine){}
    deviceUpdate(stateMachine,mouseIsConnected){}
    clickedIcon(stateMachine){}
}


class MTG_stateMouse extends MTG_stateMachineState
{
    enter(stateMachine)
    {
        stateMachine.MTG_setTouchpadState(false)
        stateMachine.MTG_setMouseState(true)
        stateMachine.update_appearance("input-mouse-symbolic","Click to switch to touchpad")
    }
    clickedIcon(stateMachine)
    {
        stateMachine.change("touchpad")
    }
    deviceUpdate(stateMachine,mouseIsConnected)
    {
        if(!mouseIsConnected)
            stateMachine.change("mouse-disconnected")
    }
}

class MTG_stateTouchpad extends MTG_stateMachineState
{
    enter(stateMachine)
    {
        stateMachine.MTG_setTouchpadState(true)
        stateMachine.MTG_setMouseState(false)
        stateMachine.update_appearance("input-touchpad-symbolic","No mouse connected")

    }
    clickedIcon(stateMachine)
    {
        stateMachine.change("mouse")
    }
}

class MTG_stateMouseDisconnected extends MTG_stateMachineState
{
    enter(stateMachine)
    {
        stateMachine.MTG_setTouchpadState(true)
        // stateMachine.MTG_setMouseState(true) //mouse is disconnected : this would throw (or do nothing, whatever)
        stateMachine.update_appearance("xsi-window-close-symbolic","No mouse connected");
    }
    deviceUpdate(stateMachine,mouseIsConnected)
    {
        if(mouseIsConnected)
            stateMachine.change("mouse")
    }
}

class MouseTouchpadToggle extends Applet.IconApplet{
    constructor(metadata, orientation, panelHeight, instanceId){
        super(orientation, panelHeight, instanceId);

        this.update_appearance("process-working-symbolic","Loading Mouse Touchpad Toggle ...");

        this.touchpad_id = undefined
        this.mouse_id = undefined

        this.mode_mouse = new MTG_stateMouse()
        this.mode_touchpad = new MTG_stateTouchpad()
        this.mode_mouseDisconnected = new MTG_stateMouseDisconnected()

        this.MTG_getIds((mouse_id,touchpad_id)=>{
                this.mouse_id = mouse_id
                this.touchpad_id = touchpad_id

                if(mouse_id !== undefined)
                    this.mode_current = this.mode_mouse
                else
                    this.mode_current = this.mode_mouseDisconnected

                this.mode_current.enter(this)
        })

        this._udevClient = new GUdev.Client({ subsystems: ['input'] });
        this._udevId = this._udevClient.connect('uevent', (client, action, device) => {
            global.log(`udev ${action}: ${device.get_name()}`);
            this.MTG_updateStatus();
        });
    }

    update_appearance(icon,tooltip)
    {
        this.set_applet_icon_name(icon);
        this._applet_icon.set_icon_size(20);
        this.set_applet_tooltip(tooltip);
    }

    change(mode_name)
    {
        if(mode_name == "mouse")
        {
            this.mode_current.leave(this)
            this.mode_current = this.mode_mouse
            this.mode_current.enter(this)
        }
        else if(mode_name == "touchpad")
        {
            this.mode_current.leave(this)
            this.mode_current = this.mode_touchpad
            this.mode_current.enter(this)
        }
        else if(mode_name == "mouse-disconnected")
        {
            this.mode_current.leave(this)
            this.mode_current = this.mode_mouseDisconnected
            this.mode_current.enter(this)
        }
        else
        {
            throw `Cannot change to mode : ${mode_name}`
        }
    }


    MTG_getIds(callback) {
        this.MTG_identifyDevices("Logitech Wireless Mouse", (mouse_id, touchpad_id) => {
            callback(mouse_id,touchpad_id)
        });
    }

    MTG_updateStatus() {
        this.MTG_identifyDevices("Logitech Wireless Mouse", (mouse_id, touchpad_id) => {
            if(mouse_id !== undefined)
                this.mouse_id = mouse_id
            if(touchpad_id !== undefined)
                this.touchpad_id = touchpad_id
            this.mode_current.deviceUpdate(this,mouse_id !== undefined)
        });
    }

    MTG_setTouchpadState(activated)
    {
        if(!GLib.spawn_command_line_async(`xinput ${activated ? "--enable" : "--disable"} ${this.touchpad_id}`))
        {
            Main.notify("MTG error","Setting touchpad state has failed!");
        }
    }

    MTG_setMouseState(activated)
    {
        global.log(`mouse ${activated ? "activated" : "deactivated"} ! (${this.mouse_id})`)
        if(!GLib.spawn_command_line_async(`xinput ${activated ? "--enable" : "--disable"} ${this.mouse_id}`))
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


    on_applet_clicked(){
        this.mode_current.clickedIcon(this)
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
