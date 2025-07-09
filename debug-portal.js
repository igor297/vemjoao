// Script simples para debugar o portal de pagamento

async function testarPortal() {
  console.log('🔍 Debugando Portal de Pagamento');
  console.log('================================');

  const baseUrl = 'http://localhost:3000';
  const testData = {
    morador_id: '68540f83d501ababd9bc48ec',
    condominio_id: '684f0e3e5eb749bbecf97091',
    master_id: '684eec5c4af0e8961a18b1ff'
  };

  try {
    // 1. Testar GET (listar pendências)
    console.log('\n1️⃣ Testando GET - Listar Pendências');
    const getUrl = `${baseUrl}/api/portal-pagamento?morador_id=${testData.morador_id}&condominio_id=${testData.condominio_id}&status=pendente,atrasado`;
    
    const getResponse = await fetch(getUrl);
    const getData = await getResponse.json();
    
    console.log(`Status: ${getResponse.status}`);
    console.log('Resposta:', JSON.stringify(getData, null, 2));
    
    if (!getData.success) {
      console.log('❌ Erro no GET:', getData.error);
      return;
    }
    
    console.log(`✅ GET funcionando - ${getData.financeiros?.length || 0} pendências encontradas`);
    
    // Se não há pendências, não podemos testar POST
    if (!getData.financeiros || getData.financeiros.length === 0) {
      console.log('⚠️  Não há pendências para testar pagamento');
      return;
    }

    // 2. Testar POST (processar pagamento)
    console.log('\n2️⃣ Testando POST - Processar Pagamento PIX');
    
    const firstPendencia = getData.financeiros[0];
    console.log('💰 Usando pendência:', {
      id: firstPendencia._id,
      descricao: firstPendencia.descricao,
      valor: firstPendencia.valor
    });

    const postData = {
      financeiro_id: firstPendencia._id,
      morador_id: testData.morador_id,
      condominio_id: testData.condominio_id,
      master_id: testData.master_id,
      valor: firstPendencia.valor,
      metodo_pagamento: 'pix',
      descricao: firstPendencia.descricao
    };

    console.log('\n📤 Dados do POST:', JSON.stringify(postData, null, 2));

    const postResponse = await fetch(`${baseUrl}/api/portal-pagamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });

    const postResult = await postResponse.json();
    
    console.log(`\n📥 Status da resposta: ${postResponse.status}`);
    console.log('📥 Resposta do POST:', JSON.stringify(postResult, null, 2));

    if (postResponse.status === 400) {
      console.log('❌ Erro 400 - Dados inválidos ou problema na validação');
      console.log('💡 Possíveis causas:');
      console.log('  - Configuração financeira não encontrada');
      console.log('  - Morador não encontrado');
      console.log('  - Item financeiro não elegível para pagamento');
      console.log('  - Problema na validação dos dados');
    } else if (postResponse.ok) {
      console.log('✅ POST funcionando - Pagamento processado com sucesso!');
    } else {
      console.log(`❌ Erro ${postResponse.status}:`, postResult.error);
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
}

// Executar teste
testarPortal().catch(console.error);