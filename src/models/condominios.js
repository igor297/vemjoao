"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var CondominioSchema = new mongoose_1.Schema({
    nome: {
        type: String,
        required: true,
        trim: true
    },
    cep: {
        type: String,
        trim: true,
        default: ''
    },
    estado: {
        type: String,
        trim: true,
        default: ''
    },
    cidade: {
        type: String,
        trim: true,
        default: ''
    },
    bairro: {
        type: String,
        trim: true,
        default: ''
    },
    rua: {
        type: String,
        trim: true,
        default: ''
    },
    numero: {
        type: String,
        required: true,
        trim: true
    },
    complemento: {
        type: String,
        trim: true,
        default: ''
    },
    master_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        required: true,
        ref: 'Master'
    },
    // Configurações de pagamento
    valor_taxa_condominio: {
        type: Number,
        default: 0,
        min: 0
    },
    dia_vencimento: {
        type: Number,
        default: 10,
        min: 1,
        max: 31
    },
    aceita_pagamento_automatico: {
        type: Boolean,
        default: false
    },
    // Dados para recebimento
    razao_social: {
        type: String,
        trim: true,
        default: ''
    },
    cnpj: {
        type: String,
        trim: true,
        default: ''
    },
    banco: {
        type: String,
        trim: true,
        default: ''
    },
    agencia: {
        type: String,
        trim: true,
        default: ''
    },
    conta: {
        type: String,
        trim: true,
        default: ''
    },
    chave_pix: {
        type: String,
        trim: true,
        default: ''
    },
    // Configurações de cobrança
    multa_atraso: {
        type: Number,
        default: 2.0,
        min: 0,
        max: 20
    },
    juros_mes: {
        type: Number,
        default: 1.0,
        min: 0,
        max: 10
    },
    dias_aviso_vencimento: {
        type: Number,
        default: 5,
        min: 1,
        max: 15
    },
    // Observações
    observacoes_cobranca: {
        type: String,
        trim: true,
        default: ''
    },
    data_criacao: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'condominios' // Nome no plural
});
exports.default = mongoose_1.default.models.Condominio || mongoose_1.default.model('Condominio', CondominioSchema);
