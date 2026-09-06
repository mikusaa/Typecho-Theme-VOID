TOC = {
    toggle: function () {
        if (document.body) {
            document.body.classList.toggle('sidebar-show');
        }
    },

    close: function () {
        if (document.body) {
            document.body.classList.remove('sidebar-show');
        }
    },

    open: function () {
        if (document.body) {
            document.body.classList.add('sidebar-show');
        }
    }
};
