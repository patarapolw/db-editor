import $ from "jquery";
import tingle from "tingle.js";
import SimpleMDE from "simplemde";
import "bootstrap";
import flatpickr from "flatpickr";
import dbEditorHtml from "./dbEditor.html";
import "./dbEditor.scss";

export interface IColumn {
    name: string;
    width: number;
    readOnly?: boolean;
    label?: string;
    type?: "one-line" |  "multi-line" | "markdown" | "number" | "datetime" | "list";
    newEntry?: boolean;
    required?: boolean;
    requiredText?: string;
    convert?: (x: any) => string;
    parse?: (x: string) => any;
    constraint?: (x: any) => boolean;
}

export interface IDbEditorSettings {
    el: JQuery | HTMLElement;
    columns: IColumn[];
    endpoint: string;
    readOnly?: boolean;
    newEntry?: boolean;
    convert?: (x: any) => string;
}

interface IJqList {
    [key: string]: JQuery;
}

interface IMdeList {
    [key: string]: SimpleMDE;
}

interface IModalList {
    [key: string]: tingle.modal;
}

export class DbEditor {
    private settings: IDbEditorSettings;
    private page = {
        current: 0,
        count: 0,
        from: 0,
        to: 0,
        total: 0
    };

    private $el: IJqList = {};
    private mde: IMdeList = {};
    private modal: IModalList = {};

    constructor(settings: IDbEditorSettings) {
        this.settings = settings;
        this.$el.main = $(settings.el);
        this.$el.main.addClass("db-editor");
        this.$el.main.html(dbEditorHtml);

        this.$el.tbody = $("tbody", settings.el);
        this.$el.newEntryButton = $(".db-editor-new-entry-button", settings.el);
        this.$el.searchBar = $(".db-editor-search-bar", settings.el);
        this.$el.prev = $(".db-editor-prev", settings.el);
        this.$el.prevAll = $(".db-editor-prevAll", settings.el);
        this.$el.next = $(".db-editor-next", settings.el);
        this.$el.nextAll = $(".db-editor-next-all", settings.el);
        this.$el.numberCurrent = $(".db-editor-number-current", settings.el);
        this.$el.numberTotal = $(".db-editor-number-total", settings.el);

        if (typeof settings.newEntry === "boolean" && !settings.newEntry) {
            $(".db-editor-new-entry-button-nav", settings.el).hide();
        } else {
            this.$el.newEntry = $(`
            <form class="needs-validation db-editor-new-entry-editor">
                <h3>Add new entry</h3>
            </form>`);

            for (const col of this.settings.columns) {
                if (typeof col.newEntry === "boolean" && !col.newEntry) {
                    continue;
                }

                switch (col.type) {
                    case "one-line":
                    case "number":
                    case "list":
                    case "datetime":
                        this.$el[col.name] = $(`
                        <div class="form-group row">
                            <label class="col-sm-2 col-form-label">${col.label || toTitle(col.name)}</label>
                            <div class="col-sm-10">
                                <input class="form-control" type="text"
                                name="${col.name}" ${col.required ? "required" : ""}>
                            </div>
                        </div>`);
                        break;
                    case "markdown":
                    default:
                        this.$el[col.name] = $(`
                        <div class="form-group">
                            <label>${toTitle(col.name)}</label>
                            <textarea class="form-control" rows="3" name="${col.name}" ${col.required ? "required" : ""}>
                            </textarea>
                        </div>"`);
                }

                this.$el.newEntry.append(this.$el[col.name]);
                this.$el[col.name].data("col", col);

                if (col.required) {
                    $("input, textarea", this.$el[col.name]).parent().append(`
                    <div class="invalid-feedback">
                        ${col.requiredText ? col.requiredText : `${toTitle(col.name)} is required.`}
                    </div>`);
                }
            }

            this.modal.newEntry = new tingle.modal({
                footer: true,
                stickyFooter: false,
                onClose: () => {
                    (this.$el.newEntry.get(0) as HTMLFormElement).reset();
                    Object.values(this.mde).forEach((el) => el.value(""));
                }
            });

            this.$el.main.append(this.$el.newEntry);
            this.modal.newEntry.setContent(this.$el.newEntry.get(0));
            this.modal.newEntry.addFooterBtn("Save", "tingle-btn tingle-btn--primary", () => {
                for (const col of this.settings.columns) {
                    if (col.type === "markdown") {
                        this.$el[col.name].val(this.mde[col.name].value());
                    }
                }

                for (const col of this.settings.columns) {
                    if (col.required) {
                        col.constraint = col.constraint ? col.constraint : (x: any) => !!x;
                        if (!col.constraint!(this.$el[col.name].val())) {
                            this.$el.newEntry.addClass("was-validated");
                            return;
                        }
                    }
                }

                const entry = {} as any;
                for (const col of this.settings.columns) {
                    entry[col.name] = this.$el[col.name].val();
                }

                this.addEntry(entry, true);
                this.modal.newEntry.close();
            });
        }

        if (!settings.readOnly) {
            this.$el.mdEditor = $(`
            <div class="db-editor-md-editor">
                <textarea></textarea>
            </div>`);
            this.$el.main.append(this.$el.mdEditor);

            this.$el.listEditor = $(`
            <form class="db-editor-list-editor">
                <h3></h3>
                <div class="db-editor-list row">
                </div>
                <button type="button" class="btn btn-success db-editor-add-list-entry">Add</button>
            </form>`);
            this.$el.main.append(this.$el.listEditor);

            this.mde.mdEditor = new SimpleMDE({
                element: $("textarea", this.$el.mdEditor).get(0),
                spellChecker: false,
                previewRender: settings.convert
            });

            for (const col of this.settings.columns) {
                if (col.type === "markdown") {
                    if (typeof col.newEntry === "boolean" && !col.newEntry) {
                        continue;
                    }

                    col.convert = col.convert ? col.convert : this.settings.convert;

                    this.mde[col.name] = new SimpleMDE({
                        element: $("textarea", this.$el[col.name]).get(0),
                        spellChecker: false,
                        previewRender: col.convert
                    });
                }
            }

            this.modal.mdEditor = new tingle.modal({
                footer: true,
                stickyFooter: false,
                onClose: () => this.mde.mdEditor.value("")
            });
            this.modal.mdEditor.setContent(this.$el.mdEditor.get(0));
            this.modal.mdEditor.addFooterBtn("Save", "tingle-btn tingle-btn--primary", () => {
                const val = this.mde.mdEditor.value();
                const $target = this.$el.mdEditor.data("$target");
                const convertFn = $target.data("col").convert;

                this.updateServer($target, val)
                .then(() => convertFn ? $target.html(convertFn(val)) : $target.text(val));

                this.modal.mdEditor.close();
            });

            this.modal.listEditor = new tingle.modal({
                footer: true,
                stickyFooter: false,
                onClose: () => $(".db-editor-list-entry").remove()
            });
            this.modal.listEditor.setContent(this.$el.listEditor.get(0));
            this.modal.listEditor.addFooterBtn("Save", "tingle-btn tingle-btn--primary", () => {
                const ls = $(".db-editor-list-entry input").toArray().map((el) => $(el).val()).filter((el) => el).sort();
                const $target = this.$el.mdEditor.data("$target");

                this.updateServer($target, ls)
                .then(() => $target.text(ls.join("\n")));

                this.modal.listEditor.close();
            });
        }

        this.$el.prevAll.on("click", () => {
            this.page.current = 1;
            this.fetchData();
        });

        this.$el.prev.on("click", () => {
            this.page.current--;
            this.fetchData();
        });

        this.$el.next.on("click", () => {
            this.page.current++;
            this.fetchData();
        });

        this.$el.nextAll.on("click", () => {
            this.page.current = this.page.count;
            this.fetchData();
        });

        this.$el.newEntryButton.on("click", () => {
            this.modal.newEntry.open();
        });

        if (!settings.readOnly) {
            this.$el.tbody.on("click", "td", (e) => {
                const $target = $(e.target).closest("td");
                const fieldName: string = $target.data("name");
                const fieldData = $target.data("data");
                const col: IColumn = $target.data("col");

                if (col.type === "datetime") {
                    $target.find("input").get(0)._flatpickr.open();
                    return;
                }

                if (col.type === "list") {
                    if (fieldData) {
                        fieldData.forEach((el: string) => this.addListEntry(el));
                    }
                    this.addListEntry();

                    $(".db-entry-list-entry input", settings.el).each((i, el) => this.checkListInput(el as HTMLInputElement));
                    this.$el.listEditor.data("$target", $target);

                    this.modal.listEditor.open();
                    return;
                }

                if (col.type === "markdown") {
                    this.mde.mdEditor.value(fieldData);
                    this.$el.mdEditor.data("$target", $target);
                    this.modal.mdEditor.open();
                    setTimeout(() => this.mde.mdEditor.codemirror.refresh(), 0);
                    return;
                }

                const data = {
                    offset: $target.offset(),
                    height: e.target.clientHeight,
                    width: e.target.clientWidth,
                    fieldName,
                    fieldData
                };

                const $input = $("<textarea class='db-editor-cell-editor'>");
                $input.css("position", "absolute");
                this.$el.main.append($input);
                $input.offset(data.offset!);
                $input.height(data.height!);
                $input.width(data.width!);
                $input.css("max-height", `${data.height}px !important`);
                $input.val(data.fieldData);
                $input.focus();

                $input.data("fieldName", fieldName);
                $input.data("$target", $target);

                setTimeout(() => $input.addClass("db-editor-cell-editor-can-remove"), 10);
            });

            $(document.body).on("click", () => {
                $(".db-editor-cell-editor-can-remove:not(:hover)", this.$el.main).each((i, el) => {
                    this.submitTextAreaAndRemove(el);
                });
            });

            this.$el.main.on("keydown", ".db-editor-cell-editor", (e) => {
                const $target = $(e.target);
                if (e.keyCode === 13 || e.which === 13 || e.key === "Enter") {
                    if (e.shiftKey || e.metaKey) {
                        $target.trigger($.Event("keydown"), {
                            keyCode: 13,
                            shiftKey: false,
                            metaKey: false
                        });
                    } else {
                        this.submitTextAreaAndRemove(e.target);
                    }
                }
            });

            this.$el.listEditor
            .on("keydown", "input", (e) => {
                this.checkListInput(e.target);
            })
            .on("click", ".db-editor-list-entry button", (e) => {
                $(e.target).closest(".db-editor-list-entry").remove();
            });

            $(".db-editor-add-list-entry", settings.el).on("click", () => {
                this.addListEntry();
            });
        }

        this.$el.searchBar.on("keyup", () => this.fetchData());

        $("table", settings.el).width(settings.columns.map((col) => col.width).reduce((acc, x) => acc + x));

        const $thtr = $("thead tr", settings.el);
        for (const col of settings.columns) {
            const $th = $(`<th scope="col">${col.name}</th>`);
            $thtr.append($th);
            $th.width(col.width);
        }

        this.fetchData();
    }

    private async addEntry(entry: any, isNew = false) {
        let id: string = entry.id;
        if (isNew) {
            id = (await fetchJSON(this.settings.endpoint, {create: entry})).id;
        }

        const $tr = $("<tr>");

        for (const col of this.settings.columns) {
            col.convert = col.convert ? col.convert : this.settings.convert;

            const data = entry[col.name];
            const $seg = $(`
            <td>
                <div class="cell-wrapper">
                    ${col.convert ? col.convert(data) : data || ""}
                </div>
            </td>`);

            if (col.type === "datetime") {
                const $input = $(`<input class="clear" value="${data || ""}">`);
                $seg.html("");
                $seg.append($input);

                flatpickr($input, {
                    enableTime: true,
                    dateFormat: "Y-M-d H:i",
                    onClose: (_, str) => {
                        this.updateServer($seg, str)
                        .then(() => $seg.data("data", str));
                    }
                });
            }

            $seg.data("name", col.name);
            $seg.data("data", data);
            $seg.data("col", col);
            $tr.append($seg);
        }
        $tr.data("id", id);

        isNew ? this.$el.tbody.prepend($tr) : this.$el.tbody.append($tr);
    }

    private async updateServer($target: JQuery, val: any): Promise<JQuery> {
        await fetchJSON(this.settings.endpoint, {
            id: $target.closest("tr").data("id"),
            fieldName: $target.data("name"),
            fieldData: val
        }, "PUT");

        $target.data("data", val);

        return $target;
    }

    private async fetchData(limit: number = 10) {
        this.page.from = (this.page.current - 1) * limit + 1;
        if (this.page.from <= 0) {
            this.page.from = 1;
        }

        const r = await fetchJSON(this.settings.endpoint, {
            q: this.$el.searchBar.val(),
            offset: this.page.from - 1,
            limit
        });

        this.$el.tbody.html("");
        r.data.forEach((el: any) => this.addEntry(el));
        if (!r.total) {
            this.page.current = 0;
            this.page.count = 0;
            this.page.from = 0;
            this.page.to = 0;
            this.page.total = 0;

            return;
        }

        const total = r.total;

        if (this.page.from <= 0) {
            this.page.from = 1;
        }

        this.page.to = this.page.from - 1 + limit;
        if (this.page.to > total) {
            this.page.to = total;
        }

        this.page.total = total;
        this.page.count = Math.ceil(this.page.total / limit);
        if (this.page.current > this.page.count) {
            this.page.current = 0;
        } else if (this.page.current <= 0) {
            this.page.current = Math.floor((this.page.from - 1) / limit + 1);
        }

        this.setPageNav();
    }

    private setPageNav() {
        this.$el.numberCurrent.text(`${this.page.from}-${this.page.to}`);
        this.$el.numberTotal.text(this.page.total.toString());

        this.$el.prevAll.prop("disabled", !(this.page.from > 1));
        this.$el.prev.prop("disabled", !(this.page.from > 1));

        this.$el.next.prop("disabled", !(this.page.to < this.page.total));
        this.$el.nextAll.prop("disabled", !(this.page.to < this.page.total));
    }

    private addListEntry(s?: string) {
        const $listEntry = $(`
        <div class="input-group mb-2 db-editor-list-entry col-12">
            <div class="input-group-prepend">
                <button class="input-group-text btn btn-outline-danger" type="button" disabled>&#x2715;</button>
            </div>
            <input class="form-control">
        </div>`);
        $(".db-editor-list", this.$el.listEditor).append($listEntry);
        $("input", $listEntry).val(s || "");
    }

    private checkListInput(el: any) {
        const $el = $(el);
        const $button = $el.closest(".db-editor-list-entry").find("button");
        $button.prop("disabled", !$el.val());
    }

    private submitTextAreaAndRemove(el: any) {
        const $el = $(el);
        const $target = $el.data("$target");
        const col: IColumn = $target.data("col");
        const val = $el.val() as string;

        if (col.type === "number") {
            col.parse = col.parse ? col.parse : parseFloat;
        }

        if (col.constraint && !col.constraint(val)) {
        } else if (col.parse) {
            const no = col.parse(val);
            this.updateServer($target, no)
            .then(() => $target.text(col.convert ? col.convert(no) : ""));
        } else if ($el.data("fieldName") === "deck") {
            this.updateServer($el.data("$target"), val)
            .then(() => $target.text(val));
        } else {
            this.updateServer($el.data("$target"), val)
            .then(() => col.convert ? $target.html(col.convert(val)) : $target.text(val));
        }

        $el.remove();
    }
}

export default DbEditor;

function toTitle(s: string) {
    return s[0].toLocaleUpperCase() + s.slice(1);
}

async function fetchJSON(url: string, data: any = {}, method?: string): Promise<any> {
    const res = await fetch(url, {
        method: method || "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(data)
    });

    try {
        return await res.json();
    } catch (e) {
        if (res.status < 300) {
            return res.status;
        } else {
            throw new Error(res.statusText);
        }
    }
}
