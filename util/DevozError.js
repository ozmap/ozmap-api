const HTTPStatus = require("http-status");

class OZError extends Error {
    constructor(message) {
        super(message);
    }
}

class NotFound extends OZError {
    // noinspection JSMethodCanBeStatic
    get code() {
        return ConnectionRefused.code;
    }

    static get code() {
        return HTTPStatus.NOT_FOUND;
    }
}

class InternalServerError extends OZError {
    // noinspection JSMethodCanBeStatic
    get code() {
        return InternalServerError.code;
    }

    static get code() {
        return HTTPStatus.INTERNAL_SERVER_ERROR;
    }
}

class Unauthorized extends OZError {
    // noinspection JSMethodCanBeStatic
    get code() {
        return Unauthorized.code;
    }

    static get code() {
        return HTTPStatus.UNAUTHORIZED;
    }
}

class UnprocessableEntity extends OZError {
    // noinspection JSMethodCanBeStatic
    get code() {
        return UnprocessableEntity.code;
    }

    static get code() {
        return HTTPStatus.UNPROCESSABLE_ENTITY;
    }
}

class ConnectionRefused extends OZError {
    // noinspection JSMethodCanBeStatic
    get code() {
        return ConnectionRefused.code;
    }

    static get code() {
        return HTTPStatus.INTERNAL_SERVER_ERROR;
    }
}

class UnexpectedError extends OZError {
    constructor(message, code) {
        super(message);
        this._code = code;

        console.log("-----------------------------");
        console.log("UNEXPECTED ERROR CODE: ", code);
        console.log("-----------------------------");
    }

    get code() {
        return this._code;
    }
}


class UnknownError {
    constructor(status, error_message) {
        switch (status) {
            case NotFound.code:
                return new NotFound(error_message);
            case UnprocessableEntity.code:
                return new UnprocessableEntity(error_message);
            case Unauthorized.code:
                return new Unauthorized(error_message);
            default:
                if (status < 500) return new UnexpectedError(error_message, status);
        }

        return new InternalServerError(error_message);
    }
}


module.exports = {
    OZError,
    ConnectionRefused,
    InternalServerError,
    NotFound,
    UnknownError
};