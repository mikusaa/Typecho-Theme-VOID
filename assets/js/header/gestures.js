VOID_Ui.Swiper = {
    clientX: null,
    clientY: null,
    // move: function (e) {
    //     return;
    // },

    start: function(e) {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        this.clientX = e.changedTouches[0].clientX;
        this.clientY = e.changedTouches[0].clientY;
    },

    end: function (e) {
        if (this.clientY === null || !e.changedTouches || !e.changedTouches[0]) return;
        // 垂直滚动距离
        if (Math.abs(this.clientY - e.changedTouches[0].clientY) > 30) {
            VOID_Ui.closeSettingPanel();
        }
        this.clientX = null;
        this.clientY = null;
    }
};
