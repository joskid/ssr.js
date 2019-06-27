const PunkUtils = new class {

    parse(string) {

        string = string.trim();

        try {
            let json = JSON.parse(string);
            if (json && typeof json === 'object')
                return json;
        } catch (e) {}

        if (string == '') {
            return '';
        } else if (!isNaN(string) && !string.includes('.')) {  // floats are ignored because they can be decimals
            return parseInt(string);
        } else if (string === 'true') {
            return true;
        } else if (string === 'false') {
            return false;
        } else {
            return string;
        }

    };

}

const Punk = new class {

    constructor() {

        [this.lists, this.models] = [[], []];

        this.attributes = ['hidden', 'required', 'disabled'];
        this.affected = this.attributes.map(x => '[data-' + x + ']').join(', ');
        this.ignored = this.attributes.map(x => '[data-list] [data-' + x + ']').join(', ');

        this.collect();
    }

    collect() {

        let affected = Array.prototype.slice.call(document.querySelectorAll(this.affected), 0);
        let ignored = document.querySelectorAll(this.ignored);

        for (var i = 0; i < ignored.length; i++) {
            let pos = affected.indexOf(ignored[i]);
            if (pos !== -1)
                affected.splice(pos, 1);
        }

        this.influencers = {}

        for (let element of affected) {
            for (let attribute of this.attributes) {
                let element_attribute = element.getAttribute('data-' + attribute);
                if (element_attribute) {
                    let influencers = element_attribute.match(/(?<=^|\s|!|&|\||\(|\)|\;)[A-Za-z_$]+[\w$]*\.?[A-Za-z_$]+[\w$]*/g);
                    for (let influencer of influencers) {
                        if (!this.influencers[influencer]) this.influencers[influencer] = {};
                        if (!this.influencers[influencer][attribute]) this.influencers[influencer][attribute] = [];
                        this.influencers[influencer][attribute].push(element);
                    }
                }
            }
        }

    }

    draw(influencer) {
        for (let attribute in this.influencers[influencer] || {}) {
            for (let element of this.influencers[influencer][attribute] || []) {
                element[attribute] = eval(element.getAttribute('data-' + attribute)) ? true : false;
            }
        }
    }

    init() {
        this.collect();
        PunkForm.init();
        for (let list of this.lists) list.init();
        for (let model of this.models) model.init();
    }

}

const PunkForm = new class {

    constructor() {
        this.change = new Event('change');
        this.init();
    }

    init() {
        for (let input of document.querySelectorAll('form[id] input, form[id] select, form[id] textarea')) {
            input.removeEventListener('change', this.fire);
            input.addEventListener('change', this.fire);
            if (!['checkbox', 'radio'].includes(input.type)) {
                input.removeEventListener('input', this.trigger);
                input.addEventListener('input', this.trigger);
            }
        }

    }

    fire(e) {
        Punk.draw(e.target.form.id + '.' + e.target.name);
    }

    trigger(e) {
        e.target.dispatchEvent(PunkForm.change);
    }

}

class Model {

    constructor(name, methods) {

        this.name = name;

        for (let method in methods)
            this[method] = methods[method];

        this.init();

        Punk.models.push(this);

        return new Proxy(this, {
            set(obj, prop, value) {
                obj[prop] = value;
                for (let element of obj.elements[prop] || [])
                    element.innerHTML = value;
                Punk.draw(obj.name + '.' + prop)
                return true;
            }
        });

    }

    init() {

        this.element = document.querySelector('[data-model="' + this.name + '"]');

        this.elements = {};

        if (this.element)
            for (let data in this.element.dataset)
                this[data] = PunkUtils.parse(this.element.dataset[data]);

        for (let field of document.querySelectorAll('[data-model^="' + this.name + '."]')) {
            let fieldName = field.getAttribute('data-model').replace(this.name + '.', '');
            this[fieldName] = PunkUtils.parse(field.innerHTML);
            if (!this.elements[fieldName])
                this.elements[fieldName] = [];
            this.elements[fieldName].push(field);
        }

    }

}

class PunkArray extends Array {

    constructor() {
        super();
    }

    get(id) {
        return this.find(x => x.id == id);
    }

    select(props) {

        let result = new PunkArray();

        for (let item of this) {
            for (let prop in props) {
                if (item[prop] == props[prop]) {
                    result.push(item);
                }
            }
        }

        return result;

    }

    update(props) {
        for (let item of this) {
            for (let prop in props) {
                item[prop] = props[prop];
            }
        }
        return this;
    }

}

class List extends PunkArray {

    constructor(name, methods) {

        super();

        this.name = name;

        for (let method in methods) {
            this[method] = methods[method];
        }
        
        this.init();

        Punk.lists.push(this);

    }

    init() {

        for (let element of document.querySelectorAll('[data-list="' + this.name + '"]')) {
            this.add(element);
        }

    }

    add(element) {
        let item = {element: element, fields: {}}
        for (let data in element.dataset)
            item[data] = PunkUtils.parse(element.dataset[data]);
        for (let field of element.querySelectorAll('[data-list^="' + this.name + '."]')) {
            let fieldName = field.getAttribute('data-list').replace(this.name + '.', '');
            item[fieldName] = PunkUtils.parse(field.innerHTML);
            if (!item.fields[fieldName])
                item.fields[fieldName] = [];
            item.fields[fieldName].push(field);
        }
        for (let attribute of Punk.attributes)
            item[attribute] = element.querySelectorAll('[data-' + attribute + ']');
        this.push(new Proxy(item, {
            set(obj, prop, value) {
                obj[prop] = value;
                if (obj.element.dataset[prop]) {
                    obj.element.dataset[prop] = value;
                } else {
                    for (let fieldName in obj.fields) {
                        for (let field of obj.fields[fieldName])
                            field.innerHTML = value;
                    }
                }
                this[obj.name] = obj;
                for (let attribute of Punk.attributes) {
                    for (let element of obj[attribute])
                        element[attribute] = eval(element.getAttribute('data-' + attribute)) ? true : false;
                }
                return true;
            }
        }));
    }

}