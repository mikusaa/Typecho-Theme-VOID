var VOID_DialogScrollLock = {
    owners: {},

    lock: function (owner) {
        if (!owner || this.owners[owner]) {
            return;
        }

        this.owners[owner] = true;
        if (document.body && document.body.classList) {
            document.body.classList.add('void-dialog-open');
        }
    },

    unlock: function (owner) {
        var key;

        if (owner && this.owners[owner]) {
            delete this.owners[owner];
        }

        for (key in this.owners) {
            if (Object.prototype.hasOwnProperty.call(this.owners, key)) {
                return;
            }
        }

        if (document.body && document.body.classList) {
            document.body.classList.remove('void-dialog-open');
        }
    }
};
