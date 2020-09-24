const I18N = require("./I18N");
const path = require("path");
const fs = require("fs");

const {ConnectionRefused, UnknownError, InternalServerError, OZError} = require("./DevozError");

const logger = require("../util/Logger")("Util");
const db = require('../connections/Database');
class Util {
    static defaultRequestErrorHandler(error, locale = "pt_BR") {
        if (error instanceof OZError) {
            return error;
        }

        if (error.code === `ECONNREFUSED`) {
            return new ConnectionRefused(I18N.ERROR_MESSAGES.SERVICE_UNAVAILABLE[locale]);
        } else if (error.code === `ECONNRESET`) {
            return new ConnectionRefused(I18N.ERROR_MESSAGES.SERVICE_UNAVAILABLE[locale]);
        } else if (error.timeout) {
            return new InternalServerError(I18N.ERROR_MESSAGES.SERVICE_UNAVAILABLE[locale]);
        } else if (error.response) {
            return new UnknownError(error.status, (error.response.body && error.response.body.message) || (error.response.text));
        } else {
            logger.error(error.stack || error.message || error);
            return new InternalServerError(I18N.ERROR_MESSAGES.SERVICE_UNAVAILABLE[locale]);
        }
    }

    static deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    static elementDistanceLatLng(elementA, elementB) {
        let dLat = this.deg2rad(elementB.lat - elementA.lat);
        let dLon = this.deg2rad(elementB.lng - elementA.lng);
        let a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(elementA.lat)) * Math.cos(this.deg2rad(elementB.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6378.137 * c; // Distance in km
    }
    static elementDistance(elementA, elementB) {
        let R = 6378.137;
        let dLat = Util.deg2rad(parseFloat(elementB[ "latitude" ]) - parseFloat(elementA[ "latitude" ]));
        let dLon = Util.deg2rad(parseFloat(elementB[ "longitude" ]) - parseFloat(elementA[ "longitude" ]));
        let a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(Util.deg2rad(parseFloat(elementA[ "latitude" ]))) * Math.cos(Util.deg2rad(parseFloat(elementB[ "latitude" ]))) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c * 1000; // Distance in m
    }

    static getIdMap() {
        if (!this.id_map) {
            let file = path.resolve(process.env.ID_MAP_PATH || "id_map.json");
            if (!fs.existsSync(file)) {
                this.sync({});
            }

            this.id_map = require(file);
        }

        return this.id_map;
    }

    static sync(data) {
        let file = path.resolve(process.env.ID_MAP_PATH || "id_map.json");
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
    static indexBy(arr, attr = "id") {
        if(arr[0] && !arr[0].hasOwnProperty(attr)) {
            throw `Elementos não possuem atributo passado -> ${attr}`;
        }

        let ret =  new Map();

        for (let i = 0; i < arr.length; i++) {
            ret.set(arr[i][attr], arr[i]);
        }
        return ret;
    }

    static async getReverseId(model, id) {
        if(isNaN(id)) {
            // OZmap -> Synsuite
            let model = db.getModel(model).findOne({[`ozmap_${model}`]: id}).lean();
            if(model) {
                return model[`synsuite_${model}`];
            }

        } else {
            // Synsuite -> OZmap
            let model = db.getModel(model).findOne({[`synsuite_${model}`]: id}).lean();
            if(model) {
                return model[`ozmap_${model}`];
            }

        }
        throw `${model} com id ${id} não encontrado`;
    }

    static indexByIntegrationCode(array, attr = "integrationCode") {
        let indexed = {};
        for (let i = 0; i < array.length; i++) {
            let el = array[i];
            let idx = el[attr];

            indexed[idx || el.id] = el;
        }
        return indexed;
    }


    static getBoxCapacity(box) {
        let total = 0;
        for (let spt_id in box.topology.splitters) {
            if (box.topology.splitters.hasOwnProperty(spt_id)) {
                let splitter = box.topology.splitters[spt_id];
                if (splitter.isDrop) {
                    total = total + splitter.connectables.output.length;
                }
            }
        }
        return total;
    }



    async getBoxOltSource(box) {
        for (let spt_id in box.topology.splitters) {
            if (box.topology.splitters.hasOwnProperty(spt_id)) {
                let splitter = box.topology.splitters[spt_id];
                if (splitter.isDrop) {
                    try {
                        let potency = await this.ozmap.customRequest({
                            method: "GET",
                            v2_route: `network-connectors/${spt_id}/potency`
                        });
                        return potency[0].olt;
                    } catch (e) {
                        console.log(e.stack, e.message);
                    }

                }
            }
        }
    }

}

module.exports = {Util};