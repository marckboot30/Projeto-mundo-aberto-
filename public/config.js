// Todos os valores de ajuste do jogo. value = valor atual; min/max/step = limites para um futuro painel de ajuste.
window.CONFIG = {
  // Tempo
  duracaoDiaSeg:     { value: 480, min: 120, max: 1800, step: 10, info: "1 dia no jogo em segundos reais" },
  fracaoDia:         { value: 0.625, min: 0.3, max: 0.9, step: 0.025, info: "Parte do dia que é claro (5 de 8 min)" },
  horaInicio:        { value: 8, min: 0, max: 23, step: 1 },
  diaSemAgua:        { value: 4, min: 1, max: 30, step: 1, info: "Dia em que as torneiras secam" },

  // Necessidades (horas de jogo até zerar)
  horasFome:         { value: 36, min: 6, max: 120, step: 1 },
  horasSede:         { value: 32, min: 6, max: 120, step: 1 },
  horasCansaco:      { value: 20, min: 6, max: 72, step: 1 },
  horasDormirCheio:  { value: 7, min: 1, max: 12, step: 0.5 },
  danoNecessidadeH:  { value: 6, min: 0, max: 50, step: 1, info: "Vida perdida por hora com fome/sede zerada" },
  sangramentoSeg:    { value: 0.8, min: 0, max: 5, step: 0.1, info: "Vida perdida por segundo sangrando" },
  regenSeg:          { value: 0.08, min: 0, max: 1, step: 0.01 },
  chanceInfeccao:    { value: 0.30, min: 0, max: 1, step: 0.05 },
  horasInfeccao:     { value: 48, min: 6, max: 120, step: 1, info: "Horas de jogo da infecção até a morte" },
  pesoMax:           { value: 15, min: 5, max: 50, step: 1 },

  // Jogador
  velAndar:          { value: 3.2, min: 1, max: 8, step: 0.1 },
  velCorrer:         { value: 5.6, min: 2, max: 12, step: 0.1 },
  velAgachar:        { value: 1.6, min: 0.5, max: 4, step: 0.1 },

  // Zumbis
  velZumbiFator:     { value: 0.6, min: 0.2, max: 1.5, step: 0.05, info: "Velocidade do zumbi comum / velocidade andando" },
  bonusNoite:        { value: 1.2, min: 1, max: 2, step: 0.05 },
  zumbisCidade:      { value: 25, min: 0, max: 100, step: 1 },
  zumbisBairro:      { value: 45, min: 0, max: 150, step: 1 },
  zumbisFazenda:     { value: 8, min: 0, max: 60, step: 1 },
  crescimentoDia:    { value: 0.15, min: 0, max: 1, step: 0.05 },
  maxZumbis:         { value: 110, min: 20, max: 400, step: 10 },
  visaoDia:          { value: 16, min: 4, max: 40, step: 1 },
  visaoNoite:        { value: 7, min: 2, max: 30, step: 1 },
  danoZumbi:         { value: 10, min: 1, max: 40, step: 1 },
  chanceArranhao:    { value: 0.40, min: 0, max: 1, step: 0.05 },
  chanceMordida:     { value: 0.20, min: 0, max: 1, step: 0.05 },

  // Barulho (raio em metros)
  ruidoCorrer:       { value: 9, min: 0, max: 40, step: 1 },
  ruidoAndar:        { value: 3, min: 0, max: 20, step: 1 },
  ruidoGolpe:        { value: 6, min: 0, max: 30, step: 1 },
  ruidoTiro:         { value: 40, min: 5, max: 100, step: 1 },
  ruidoBarricada:    { value: 14, min: 0, max: 40, step: 1 },

  // Mundo
  vidaBarricada:     { value: 100, min: 10, max: 500, step: 10, info: "Vida por camada de tábuas" },
  maxBarricada:      { value: 3, min: 1, max: 10, step: 1 },
  distanciaVisivel:  { value: 55, min: 20, max: 150, step: 5 },
};
window.C = function (k) { return window.CONFIG[k].value; };
