'use client'

import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Alert, Table, Button, Form, Modal } from 'react-bootstrap'
import { useRouter } from 'next/navigation'

interface Colaborador {
  _id: string;
  nome: string;
  email: string;
  salario?: number;
  cargo?: string;
  // Adicione outros campos relevantes do colaborador aqui
}

interface Condominio {
  _id: string
  nome: string
}

interface FinanceiroColaborador {
  _id: string;
  colaborador_id: string;
  condominio_id: string;
  tipo: 'salario' | 'bonus' | 'desconto' | 'vale' | 'comissao' | 'hora_extra' | 'ferias' | 'decimo_terceiro';
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  observacoes?: string;
  mes_referencia?: string;
}

export default function FinanceiroColaboradoresGerenciarPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [financeiroColaborador, setFinanceiroColaborador] = useState<FinanceiroColaborador[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>('');
  const router = useRouter();

  // Estados para o modal de novo lançamento
  const [showNewLancamentoModal, setShowNewLancamentoModal] = useState(false);
  const [newLancamentoData, setNewLancamentoData] = useState<Partial<FinanceiroColaborador>>({
    tipo: 'salario',
    descricao: '',
    valor: 0,
    data_vencimento: '',
    status: 'pendente',
    mes_referencia: '',
  });

  // UseEffect para preencher automaticamente o valor quando o tipo for salário
  useEffect(() => {
    if (newLancamentoData.tipo === 'salario' && selectedColaborador) {
      setNewLancamentoData(prev => ({
        ...prev,
        valor: selectedColaborador.salario || 0,
        descricao: `Salário - ${selectedColaborador.cargo || 'Colaborador'}`
      }));
    } else if (newLancamentoData.tipo !== 'salario') {
      // Limpar dados quando não for salário
      setNewLancamentoData(prev => ({
        ...prev,
        valor: 0,
        descricao: ''
      }));
    }
  }, [newLancamentoData.tipo, selectedColaborador]);

  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        // Only Master, Sindico, Subsindico can access this page
        if (!['master', 'sindico', 'subsindico'].includes(user.tipo)) {
          router.push('/login');
          return;
        }
        
        if (user.tipo === 'master') {
          fetchCondominios(user.id)
          // Verificar condomínio ativo
          const activeCondominioId = localStorage.getItem('activeCondominio')
          if (activeCondominioId) {
            setSelectedCondominiumId(activeCondominioId)
            fetchColaboradores(activeCondominioId, user.id)
          }
        } else {
          // Para não-masters, usar condomínio do usuário
          if (user.condominio_id) {
            setSelectedCondominiumId(user.condominio_id)
            fetchColaboradores(user.condominio_id, user.master_id)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        setLoading(false);
        showAlert('danger', 'Erro ao carregar suas informações. Tente fazer login novamente.');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  // UseEffect para verificar condomínio ativo periodicamente
  useEffect(() => {
    if (currentUser?.tipo === 'master') {
      const interval = setInterval(() => {
        const activeCondominio = localStorage.getItem('activeCondominio')
        if (activeCondominio && activeCondominio !== selectedCondominiumId) {
          console.log('Atualizando condomínio ativo:', activeCondominio)
          setSelectedCondominiumId(activeCondominio)
          fetchColaboradores(activeCondominio, currentUser.id)
          setSelectedColaborador(null) // Reset colaborador selecionado
          setFinanceiroColaborador([]) // Limpar dados financeiros
        }
      }, 1000) // Verifica a cada segundo

      return () => clearInterval(interval)
    }
  }, [currentUser, selectedCondominiumId]);

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const fetchCondominios = async (masterId: string) => {
    try {
      const response = await fetch(`/api/condominios?master_id=${masterId}`)
      const data = await response.json()
      
      if (data.success) {
        setCondominios(data.condominios)
      }
    } catch (error) {
      console.error('Erro ao carregar condomínios:', error)
    }
  }

  const fetchColaboradores = async (condominioId: string, masterId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/colaboradores?condominio_id=${condominioId}&master_id=${masterId}`);
      const data = await response.json();
      if (data.success) {
        setColaboradores(data.colaboradores);
      } else {
        showAlert('danger', data.error || 'Erro ao carregar lista de colaboradores.');
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
      showAlert('danger', 'Não foi possível buscar a lista de colaboradores.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinanceiroDoColaborador = async (colaboradorId: string) => {
    setLoading(true);
    try {
      const masterId = currentUser?.tipo === 'master' ? currentUser.id : currentUser?.master_id;
      const params = new URLSearchParams({
        colaborador_id: colaboradorId,
        master_id: masterId,
        condominio_id: selectedCondominiumId,
        tipo_usuario: currentUser?.tipo || '',
        usuario_id: currentUser?.id || ''
      });
      
      const response = await fetch(`/api/financeiro-colaboradores?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setFinanceiroColaborador(data.lancamentos);
      } else {
        showAlert('danger', data.error || 'Erro ao carregar dados financeiros do colaborador.');
        setFinanceiroColaborador([]);
      }
    } catch (error) {
      console.error('Erro ao carregar financeiro do colaborador:', error);
      showAlert('danger', 'Não foi possível buscar os dados financeiros do colaborador.');
      setFinanceiroColaborador([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectColaborador = (colaborador: Colaborador) => {
    setSelectedColaborador(colaborador);
    fetchFinanceiroDoColaborador(colaborador._id);
  };

  const handleCondominioChange = (condominioId: string) => {
    setSelectedCondominiumId(condominioId)
    setSelectedColaborador(null) // Reset colaborador selecionado
    setFinanceiroColaborador([]) // Limpar dados financeiros
    if (condominioId && currentUser) {
      fetchColaboradores(condominioId, currentUser.id)
    }
  }

  const formatCurrencyDisplay = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: { bg: 'warning', text: 'Pendente' },
      pago: { bg: 'success', text: 'Pago' },
      atrasado: { bg: 'danger', text: 'Atrasado' },
      cancelado: { bg: 'secondary', text: 'Cancelado' }
    };
    const config = variants[status as keyof typeof variants] || variants.pendente;
    return <span className={`badge bg-${config.bg}`}>{config.text}</span>;
  };

  const getTipoLabel = (tipo: string) => {
    const labels = {
      salario: 'Salário',
      bonus: 'Bônus',
      desconto: 'Desconto',
      vale: 'Vale',
      comissao: 'Comissão',
      hora_extra: 'Hora Extra',
      ferias: 'Férias',
      decimo_terceiro: '13º Salário'
    };
    return labels[tipo as keyof typeof labels] || tipo;
  };

  const handleSaveNewLancamento = async () => {
    if (!selectedColaborador || !selectedCondominiumId) {
      showAlert('danger', 'Selecione um colaborador e um condomínio antes de adicionar um lançamento.');
      return;
    }

    if (!newLancamentoData.descricao || !newLancamentoData.valor || !newLancamentoData.data_vencimento) {
      showAlert('danger', 'Preencha todos os campos obrigatórios para o novo lançamento.');
      return;
    }

    try {
      const masterId = currentUser?.tipo === 'master' ? currentUser.id : currentUser?.master_id;
      const response = await fetch('/api/financeiro-colaboradores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newLancamentoData,
          colaborador_id: selectedColaborador._id,
          condominio_id: selectedCondominiumId,
          master_id: masterId,
          tipo_usuario: currentUser?.tipo,
          usuario_id: currentUser?.id,
          criado_por_nome: currentUser?.nome,
          valor: parseFloat(newLancamentoData.valor as any),
        }),
      });

      const data = await response.json();

      if (data.success) {
        showAlert('success', 'Lançamento adicionado com sucesso!');
        setShowNewLancamentoModal(false);
        setNewLancamentoData({
          tipo: 'salario',
          descricao: '',
          valor: 0,
          data_vencimento: '',
          status: 'pendente',
          mes_referencia: '',
        });
        fetchFinanceiroDoColaborador(selectedColaborador._id); // Recarregar lançamentos
      } else {
        showAlert('danger', data.error || 'Erro ao adicionar lançamento.');
      }
    } catch (error) {
      console.error('Erro ao salvar novo lançamento:', error);
      showAlert('danger', 'Não foi possível salvar o novo lançamento.');
    }
  };

  if (loading && !currentUser) {
    return (
      <Container fluid className="mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
        <p className="mt-2">Carregando informações do usuário...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Row className="mb-4">
        <Col>
          <h2 className="mb-1">Gerenciar Financeiro de Colaboradores</h2>
          <p className="text-muted mb-0">Visualize e gerencie os lançamentos financeiros de todos os colaboradores.</p>
        </Col>
      </Row>

      {/* Filtro de Condomínio para Masters */}
      {currentUser?.tipo === 'master' && (
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Selecionar Condomínio *</Form.Label>
                      <Form.Select
                        value={selectedCondominiumId}
                        onChange={(e) => handleCondominioChange(e.target.value)}
                      >
                        <option value="">Selecione um condomínio</option>
                        {condominios.map((cond) => (
                          <option key={cond._id} value={cond._id}>
                            {cond.nome}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        {selectedCondominiumId ? (
                          localStorage.getItem('activeCondominio') === selectedCondominiumId ? (
                            <span className="text-success">
                              ✅ Condomínio ativo selecionado automaticamente
                            </span>
                          ) : (
                            <span className="text-info">
                              📋 Condomínio selecionado manualmente
                            </span>
                          )
                        ) : (
                          <span className="text-warning">
                            ⚠️ Selecione um condomínio para ver os colaboradores
                          </span>
                        )}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6} className="d-flex align-items-end">
                    <div className="w-100">
                      <small className="text-muted">
                        <strong>Total de colaboradores:</strong> {colaboradores.length}
                      </small>
                      {localStorage.getItem('activeCondominio') && (
                        <div className="mt-1">
                          <small className="text-success">
                            🏢 <strong>Condomínio Ativo:</strong> {localStorage.getItem('activeCondominioName') || 'Carregando...'}
                          </small>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Row>
        <Col md={4}>
          <Card>
            <Card.Header><h5>Colaboradores</h5></Card.Header>
            <Card.Body style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status"></div>
                  <p className="mt-2">Carregando colaboradores...</p>
                </div>
              ) : colaboradores.length === 0 ? (
                <p className="text-center text-muted">Nenhum colaborador encontrado.</p>
              ) : (
                <Table hover size="sm">
                  <tbody>
                    {colaboradores.map((colaborador) => (
                      <tr
                        key={colaborador._id}
                        onClick={() => handleSelectColaborador(colaborador)}
                        className={selectedColaborador?._id === colaborador._id ? 'table-primary' : ''}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{colaborador.nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>
                {selectedColaborador
                  ? `Lançamentos de ${selectedColaborador.nome}`
                  : 'Selecione um Colaborador'}
              </h5>
              {selectedColaborador && (
                <Button variant="primary" size="sm" onClick={() => {
                  // Reset do formulário com dados iniciais
                  setNewLancamentoData({
                    tipo: 'salario',
                    descricao: '',
                    valor: 0,
                    data_vencimento: '',
                    status: 'pendente',
                    mes_referencia: '',
                  });
                  setShowNewLancamentoModal(true);
                }}>
                  + Novo Lançamento
                </Button>
              )}
            </Card.Header>
            <Card.Body>
              {!selectedColaborador ? (
                <p className="text-center text-muted">Selecione um colaborador na lista ao lado para visualizar seus lançamentos financeiros.</p>
              ) : loading ? (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status"></div>
                  <p className="mt-2">Carregando lançamentos...</p>
                </div>
              ) : financeiroColaborador.length === 0 ? (
                <p className="text-center text-muted">Nenhum lançamento financeiro encontrado para este colaborador.</p>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th>Mês de Referência</th>
                      <th>Valor</th>
                      <th>Vencimento</th>
                      <th>Pagamento</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeiroColaborador.map((item) => (
                      <tr key={item._id}>
                        <td>{getTipoLabel(item.tipo)}</td>
                        <td>{item.descricao}</td>
                        <td>{item.mes_referencia || '-'}</td>
                        <td>{formatCurrencyDisplay(item.valor)}</td>
                        <td>{new Date(item.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                        <td>{item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</td>
                        <td>{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showNewLancamentoModal} onHide={() => setShowNewLancamentoModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Novo Lançamento para {selectedColaborador?.nome}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tipo de Lançamento</Form.Label>
              <Form.Select
                value={newLancamentoData.tipo}
                onChange={(e) => setNewLancamentoData({ ...newLancamentoData, tipo: e.target.value as any })}
              >
                <option value="salario">Salário</option>
                <option value="bonus">Bônus</option>
                <option value="desconto">Desconto</option>
                <option value="vale">Vale</option>
                <option value="comissao">Comissão</option>
                <option value="hora_extra">Hora Extra</option>
                <option value="ferias">Férias</option>
                <option value="decimo_terceiro">13º Salário</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ex: Salário de Junho, Bônus por meta..."
                value={newLancamentoData.descricao}
                onChange={(e) => setNewLancamentoData({ ...newLancamentoData, descricao: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Valor</Form.Label>
              <Form.Control
                type="number"
                placeholder="0.00"
                value={newLancamentoData.valor}
                onChange={(e) => setNewLancamentoData({ ...newLancamentoData, valor: parseFloat(e.target.value) })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Data de Vencimento</Form.Label>
              <Form.Control
                type="date"
                value={newLancamentoData.data_vencimento}
                onChange={(e) => setNewLancamentoData({ ...newLancamentoData, data_vencimento: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Mês de Referência (MM/AAAA)</Form.Label>
              <Form.Control
                type="text"
                placeholder="MM/AAAA"
                value={newLancamentoData.mes_referencia}
                onChange={(e) => setNewLancamentoData({ ...newLancamentoData, mes_referencia: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={newLancamentoData.status}
                onChange={(e) => setNewLancamentoData({ ...newLancamentoData, status: e.target.value as any })}
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNewLancamentoModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveNewLancamento}>
            Salvar Lançamento
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
