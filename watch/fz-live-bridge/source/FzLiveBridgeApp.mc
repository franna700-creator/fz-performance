using Toybox.Application;
using Toybox.Background;
using Toybox.System;
using Toybox.Time;

class FzLiveBridgeApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
    }

    function getInitialView() {
        if (Toybox.System has :ServiceDelegate) {
            try {
                Background.registerForTemporalEvent(new Time.Duration(5 * 60));
            } catch (e) {
                System.println("FZ temporal registration: " + e.getErrorMessage());
            }
        }
        return [new FzLiveBridgeView()];
    }

    function getServiceDelegate() {
        return [new FzLiveBridgeService()];
    }

    function onSettingsChanged() {
        if (Toybox.System has :ServiceDelegate) {
            try {
                Background.registerForTemporalEvent(new Time.Duration(5 * 60));
            } catch (e) {
                System.println("FZ temporal re-registration: " + e.getErrorMessage());
            }
        }
        Toybox.WatchUi.requestUpdate();
    }

    function onStop(state) {
    }
}
