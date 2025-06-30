"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var MasterSchema = new mongoose_1.Schema({
    // Keep id_master for backward compatibility but make it optional
    id_master: {
        type: String,
        required: false,
        unique: true,
        sparse: true // Allows multiple null values
    },
    nome: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (email) {
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
            },
            message: 'Email deve ter um formato válido'
        }
    },
    senha: {
        type: String,
        required: true,
        minlength: [8, 'Senha deve ter pelo menos 8 caracteres'],
        validate: {
            validator: function (senha) {
                // Senha deve ter pelo menos 8 caracteres, incluindo: maiúscula, minúscula, número e caractere especial
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])[^\s]{8,}$/.test(senha);
            },
            message: 'Senha deve ter pelo menos 8 caracteres, incluindo: maiúscula, minúscula, número e caractere especial'
        }
    },
    celular1: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v);
            },
            message: 'Celular deve estar no formato (XX) XXXXX-XXXX'
        }
    },
    celular2: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v);
            },
            message: 'Celular deve estar no formato (XX) XXXXX-XXXX'
        }
    },
    data_criacao: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});
exports.default = mongoose_1.default.models.Master || mongoose_1.default.model('Master', MasterSchema);
