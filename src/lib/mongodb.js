"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
// Configuração apenas para localhost
var MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistemas';
if (!MONGODB_URI) {
    console.error('❌ [MongoDB] MONGODB_URI não encontrada!');
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}
if (process.env.NODE_ENV === 'development') {
    console.log("\uD83D\uDD17 [MongoDB] Conectando ao MongoDB: ".concat(MONGODB_URI));
}
var cached = global.mongodb;
if (!cached) {
    cached = global.mongodb = { conn: null, promise: null };
}
function connectDB() {
    return __awaiter(this, void 0, void 0, function () {
        var opts, _a, e_1;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (cached.conn) {
                        return [2 /*return*/, cached.conn];
                    }
                    if (!cached.promise) {
                        opts = {
                            bufferCommands: false,
                            maxPoolSize: 10,
                            serverSelectionTimeoutMS: 30000,
                            socketTimeoutMS: 45000,
                            connectTimeoutMS: 30000,
                            family: 4,
                            maxIdleTimeMS: 30000,
                            retryWrites: true,
                            retryReads: true,
                        };
                        cached.promise = mongoose_1.default.connect(MONGODB_URI, opts).then(function (mongoose) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (process.env.NODE_ENV === 'development') {
                                    console.log('✅ [MongoDB] Conexão estabelecida!');
                                }
                                return [2 /*return*/, mongoose];
                            });
                        }); }).catch(function (error) {
                            console.error('❌ [MongoDB] Erro na conexão:', error.message);
                            throw error;
                        });
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    _a = cached;
                    return [4 /*yield*/, cached.promise];
                case 2:
                    _a.conn = _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _b.sent();
                    cached.promise = null;
                    throw e_1;
                case 4: return [2 /*return*/, cached.conn];
            }
        });
    });
}
exports.default = connectDB;
