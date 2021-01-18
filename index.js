const logger = require("./util/Logger")("OZmap");
const superagent = require("superagent");
const HttpStatus = require('http-status');

let Models = {
    box: "boxes",
    splitter: "splitters",
    project: "projects",
    client: "ftth-clients",
    property: "properties",
    olt: "olts",
    building: "buildings",
    region: "regions"
};

class OZmap {
    constructor(key, url) {


        this.key = key;
        this.url = url || process.env.OZMAP_URL

        this.projects = {};
        this.generateExecLog();
        if (!process.env.OZMAP_URL && !url) {
            console.error("Não foi especificada uma URL para o OZmap. Defina uma variável de ambiente OZMAP_URL.");
        }
    }

    generateExecLog() {
        let previous = JSON.stringify(this.exec_log);
        this.exec_log = {
            create: [],
            update: [],
            delete: [],
            custom: []
        };
        return previous;
    }

    async authenticate({login, password, key} ) {
        logger.silly(`Realizando autenticação no OZmap`);

        logger.silly(`Verificando se a chave existente ainda é válida: ${this.key}`);
        try {
            await superagent.get(`${this.url}/api/v2/authenticated`).set({Authorization: this.key}).send();
            logger.silly("Chave válida");
        } catch (err) {
            logger.silly("Chave não estava válida, realizando login");
            let result = await superagent.post(`${this.url}/api/v2/users/login`).send({
                login: login,
                password: password
            });
            let {username, name, apiKey} = result;
            logger.silly(`Login realizado com sucesso -> ${JSON.stringify({username, name, apiKey})}`);

            this.key = result.body.authorization;
        }
        return this.key;
    }

    async create({model, data, retrying}) {

        let base_url = `${this.url}/api/v2/${model}?`;

        logger.silly(`Enviando: ${base_url} --> ${JSON.stringify(data)}`);
        this.exec_log.create.push(data);
        if(process.env.DRY_RUN === "true") {
            return;
        }
        try{
            let result = await superagent.post(base_url).set({Authorization: this.key}).send(data);

            return result.body;
        } catch(e) {
            throw e;
        }
    }

    async update({model, model_id, data, retrying}) {
        let base_url = `${this.url}/api/v2/${model}/${model_id}`;

        logger.silly(`Alterando: ${base_url} --> ${JSON.stringify(data)}`);
        this.exec_log.update.push(data);
        if(process.env.DRY_RUN === "true") {
            return;
        }
        try{
            let result = await superagent.patch(base_url).set({Authorization: this.key}).send(data);
            return result.body;
        } catch(e) {
            throw e;
        }
    }

    async delete({model, model_id, retrying}) {

        let base_url = `${this.url}/api/v2/${model}/${model_id}`;

        logger.silly(`Deletando: ${base_url}`);
        this.exec_log.delete.push(model_id);
        if(process.env.DRY_RUN === "true") {
            return;
        }
        try{
            let result = await superagent.delete(base_url).set({Authorization: this.key}).send();
            return result.body;
        } catch(e) {
            throw e;
        }
    }

    async read(model, query) {
        if(model instanceof Object && model.constructor === Object) {
            return this._read(model);
        } else if(typeof model === "string") {
            let filter = [];
            if(query && Object.keys(query).length) {

                filter = Object.keys(query).map(el => ({property: el, operator: "=", value: query[el]}));
            }

            return this._read({
                model: model,
                filter: filter
            });
        }
    }
    async _read({model, limit, page, filter, select, sort, populate, retrying}) {
        let body = null;
        let base_url = `${this.url}/api/v2/${model}?`;


        if(process.env.FILTER_MODE === "URL") {
            if (filter) {
                if(!Array.isArray(filter)) {
                    filter = [filter];
                }

                let encodeURIRecursive = function(el) {
                    filter = el.map(el => {
                        if((Array.isArray(el))){
                            return encodeURIRecursive(el);
                        } else {
                            if(el.operator === "near") {
                                return el;
                            }else if(Array.isArray(el.value)) {
                                el.value = el.value.map(el => encodeURIComponent(el));
                                return el;
                            } else {
                                return {...el, value: encodeURIComponent(el.value)}
                            }
                        }
                    });
                    return filter;
                };
                filter = encodeURIRecursive(filter);

                base_url = `${base_url}&filter=${JSON.stringify(filter)}`;
            }
        } else {
            body = {filter};
        }

        if (select) {
            base_url = `${base_url}&select=${select}`;
        }

        if (limit != null) {
            base_url = `${base_url}&limit=${limit}`;
        }

        if (populate != null) {
            base_url = `${base_url}&populate=${populate}`;
        }

        if (page != null) {
            base_url = `${base_url}&page=${page}`;
        }
        if (sort != null) {
            base_url = `${base_url}&sort=${JSON.stringify(sort)}`;
        }

        logger.silly(`Buscando: ${base_url} ${body ? JSON.stringify(body): ''}`);
        try{
            let result = await superagent.get(base_url).set({Authorization: this.key}).send(body);
            return result.body;
        } catch(e) {
            throw e;
        }
    }

    async readById({model, model_id, select, retrying}) {
        let base_url = `${this.url}/api/v2/${model}/${model_id}?`;

        if (select) {
            base_url = `${base_url}&select=${select}`;
        }

        logger.silly(`Buscando: ${base_url}`);
        try{
            let result = await superagent.get(base_url).set({Authorization: this.key}).send();

            return result.body;
        } catch(e) {
            throw e;
        }

    }

    async fetchAllWithPagination({model, limit = 500, filter, populate, select, sort}) {
        let finished = false;
        let ret = [];
        let page = 1;
        try {
            while (!finished) {
                let { rows: read_page } = await this.read({model, limit, page, filter, populate, select, sort});
                if (read_page.length) {
                    ret = ret.concat(read_page);
                } else {
                    finished = true;
                }
                page++;
            }
        }catch(e) {
            throw e;
        }


        return {rows: ret};
    }
    // async customWithPagination({method, v2_route, query, data, retrying, limit=500}) {
    //     let finished = false;
    //     let ret = [];
    //     let page = 1;
    //     try {
    //         while (!finished) {
    //             let route = `{v2_route}?page=${page}&limit=${limit}`
    //             let { rows: read_page } = await this.customRequest({method, v2_route, query, data, retrying});
    //             if (read_page.length) {
    //                 ret = ret.concat(read_page);
    //             } else {
    //                 finished = true;
    //             }
    //             page++;
    //         }
    //     }catch(e) {
    //         console.error(e);
    //     }
    //
    //
    //     return ret;
    // }

    async customRequest({method, v2_route, query, data, retrying}) {
        let base_url = `${this.url}/api/v2/${v2_route}?`;

        query = query || {};

        for (let query_name in query) {
            if (query.hasOwnProperty(query_name)) {
                base_url = `${base_url}&${query_name}=${query[query_name]}`;
            }
        }

        logger.silly(`Buscando: ${base_url}`);
        this.exec_log.custom.push(data);
        if(process.env.DRY_RUN === "true" && method !== "GET" && v2_route !== "users/login") {
            return;
        }
        try{
            let result = await superagent[method.toLowerCase()](base_url).set({Authorization: this.key}).timeout(999999).send(data);

            return result.body;
        } catch(e) {
            throw e;
        }
    }
}

module.exports = {OZmap: OZmap, OZModels: Models};