using Toybox.Application;
using Toybox.Graphics;
using Toybox.WatchUi;

class FzLiveBridgeView extends WatchUi.View {
    function initialize() {
        View.initialize();
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);

        var token = Application.Properties.getValue("fzToken");
        var configured = token != null && token.toString().length() > 0;
        var cx = dc.getWidth() / 2;
        var cy = dc.getHeight() / 2;

        dc.drawText(cx, cy - 55, Graphics.FONT_MEDIUM, "FZ LIVE", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, cy - 10, Graphics.FONT_SMALL, configured ? "Bridge configured" : "Setup required", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, cy + 25, Graphics.FONT_XTINY, configured ? "Background sync: 5 min" : "Enter token in app settings", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, cy + 48, Graphics.FONT_XTINY, "Intervals remains daily fallback", Graphics.TEXT_JUSTIFY_CENTER);
    }
}
