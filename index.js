const logger = require("./util/Logger")("OZmap");
const superagent = require("superagent");

let Models = {
  box: "boxes",
  splitter: "splitters",
  project: "projects",
  client: "ftth-clients",
  property: "properties",
  olt: "olts",
  building: "buildings",
  region: "regions",
  network_connector: "network-connectors",
  network_connectable: "network-connectables",
  fiber: "fibers",
  drop: "drops",
  horizontal_condominium: "horizontal-condominiums"

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

  async authenticate({login, password}) {
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

  async create({model, data}) {

    let base_url = `${this.url}/api/v2/${model}?`;

    logger.silly(`Enviando: ${base_url} --> ${JSON.stringify(data)}`);
    this.exec_log.create.push(data);
    if (process.env.DRY_RUN === "true") {
      return;
    }
    try {
      let result = await superagent.post(base_url)
          .timeout({
            response: 240000,
            deadline: 1800000
          })
          .set({Authorization: this.key}).send(data);

      return result.body;
    } catch (e) {
      throw e;
    }
  }

  async update({model, model_id, data, extra_headers = {}}) {
    let base_url = `${this.url}/api/v2/${model}/${model_id}`;

    logger.silly(`Alterando: ${base_url} --> ${JSON.stringify(data)}`);
    this.exec_log.update.push(data);
    if (process.env.DRY_RUN === "true") {
      return;
    }
    try {
      let result = await superagent.patch(base_url)
          .timeout({
            response: 240000,
            deadline: 1800000
          })
          .set({Authorization: this.key, ...extra_headers}).send(data);
      return result.body;
    } catch (e) {
      throw e;
    }
  }

  async delete({model, model_id, timeout, extra_headers = {}}) {

    let base_url = `${this.url}/api/v2/${model}/${model_id}`;

    logger.silly(`Deletando: ${base_url}`);
    this.exec_log.delete.push(model_id);
    if (process.env.DRY_RUN === "true") {
      return;
    }
    try {
      let result = await superagent.delete(base_url)
          .timeout({
            response: 240000,
            deadline: 1800000
          })
          .set({Authorization: this.key, ...extra_headers}).send();
      return result.body;
    } catch (e) {
      throw e;
    }
  }

  async read(model, query, extra_headers = {}) {
    if (model instanceof Object && model.constructor === Object) {
      return this._read(model);
    } else if (typeof model === "string") {
      let filter = [];
      if (query && Object.keys(query).length) {

        filter = Object.keys(query).map(el => ({property: el, operator: "=", value: query[el]}));
      }

      return this._read({
        model: model,
        filter: filter,
        extra_headers: extra_headers
      });
    }
  }

  async _read({model, limit, page = null, filter, select, sort, populate, timeout, extra_headers = {}}) {
    let body = null;
    let base_url = `${this.url}/api/v2/${model}?`;


    if (process.env.FILTER_MODE === "URL") {
      if (filter) {
        if (!Array.isArray(filter)) {
          filter = [filter];
        }

        let encodeURIRecursive = function (el) {
          filter = el.map(el => {
            if ((Array.isArray(el))) {
              return encodeURIRecursive(el);
            } else {
              if (el.operator === "near") {
                return el;
              } else if (Array.isArray(el.value)) {
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

    logger.silly(`Buscando: ${base_url} ${body ? JSON.stringify(body) : ''}`);
    try {
      let result = await superagent.get(base_url)
          .timeout({
            response: 240000,
            deadline: 1800000
          })
          .set({Authorization: this.key, ...extra_headers}).send(body);
      return result.body;
    } catch (e) {
      throw e;
    }
  }

  async readById({model, model_id, select, timeout, extra_headers = {}}) {
    let base_url = `${this.url}/api/v2/${model}/${model_id}?`;

    if (select) {
      base_url = `${base_url}&select=${select}`;
    }

    logger.silly(`Buscando: ${base_url}`);
    try {
      let result = await superagent.get(base_url)
          .timeout({
            response: 240000,
            deadline: 1800000
          })
          .set({
            Authorization: this.key,
            ...extra_headers
          }).send();

      return result.body;
    } catch (e) {
      throw e;
    }

  }

  async fetchAllWithPagination({model, limit = 500, filter, populate, select, sort, timeout, extra_headers}) {
    let ret = [];
    let has_next_page = false;
    let next_url;

    try {
      const { rows: read_page, hasNextPage, nextUrl } = await this.read({model, limit, filter, populate, select, sort, extra_headers});

      ret = ret.concat(read_page || []);
      has_next_page = hasNextPage;
      next_url = nextUrl

      while (has_next_page) {
        logger.silly(`Buscando: ${this.url}${next_url} ${JSON.stringify({filter})}`);

        const { body: response } = await superagent.get(`${this.url}${next_url}`)
          .timeout({
            response: 240000,
            deadline: 1800000
          })
          .set({Authorization: this.key, ...extra_headers}).send({filter});
        
        if (response.rows && response.rows.length) {
          ret = ret.concat(response.rows);
        }

        has_next_page = response.hasNextPage;
        next_url = response.nextUrl;
      }
    } catch (e) {
      throw e;
    }

    return { rows: ret };
  }

  async customRequest({method = "GET", v2_route = "", query = {}, data, timeout, extra_headers = {}}) {
    let base_url = `${this.url}/api/v2/${v2_route}?`;

    for (let query_name in query) {
      if (query.hasOwnProperty(query_name)) {
        base_url = `${base_url}&${query_name}=${query[query_name]}`;
      }
    }

    logger.silly(`Buscando: ${base_url}`);
    this.exec_log.custom.push(data);
    if (process.env.DRY_RUN === "true" && method !== "GET" && v2_route !== "users/login") {
      return;
    }
    try {
      let result = await superagent[method.toLowerCase()](base_url).set({Authorization: this.key, ...extra_headers})
          .timeout({
            response: 240000,
            deadline: 1800000
          }).send(data);

      return result.body;
    } catch (e) {
      throw e;
    }
  }


  async exportCroqui(property_id, export_type = "png") {
    let base_url = `${this.url}/api/v2/render/croqui/${property_id}/${export_type}?`;
    logger.debug(`Buscando croqui(${export_type}) com a url: ${base_url}`);
    let res_img = await superagent
        .get(base_url)
        .buffer(true)
        .parse(superagent.parse.image)
        .set({Authorization: this.key})
        .timeout({
          response: 50000,
          deadline: 50000
        });

    return res_img.body;
  }

  async exportBox(box_id, highlight = [], export_type = "png") {
    let base_url = `${this.url}/api/v2/render/box/${box_id}/${export_type}`;
    logger.debug(`Buscando box (${export_type}) com a url: ${base_url}`);
    let res_box = await superagent.post(base_url)
        .send({
          highlight,
          exhibition: {
            icon: "fas fa-list-ol",
            name: "number",
            tooltip: "Número da fibra"
          }
        })
        .buffer(true).parse(superagent.parse.image)
        .set({Authorization: this.key})
        .timeout({
          response: 50000,
          deadline: 50000
        });

    return res_box.body;
  }

  getLogger(){
    return logger;
  }
}

module.exports = {OZmap: OZmap, OZModels: Models};