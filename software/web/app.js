var medicoes = [];

const valorAtual = document.getElementById("valorAtual");
const classificacao = document.getElementById("classificacao");
const horario = document.getElementById("horario");
const media = document.getElementById("media");
const maximo = document.getElementById("maximo");
const minimo = document.getElementById("minimo");
const tendencia = document.getElementById("tendencia");
const historico = document.getElementById("historico");
const cardClassificacao = document.getElementById("cardClassificacao");
const canvas = document.getElementById("grafico");

async function carregarMedicoes() {
    try {
        const resposta = await fetch("/medicoes");
        medicoes = await resposta.json();
        renderizar();
    }
    catch (erro) {
        console.log("Erro ao carregar medições:", erro);
    }
}

function renderizar() {
    if (medicoes.length === 0) {
        return;
    }

    const ultimas = medicoes.slice(-20);
    const ultima = ultimas[ultimas.length - 1];
    const valores = ultimas.map(medicao => medicao.sample[0]);

    valorAtual.textContent = ultima.sample[0];
    classificacao.textContent = ultima.classification;
    horario.textContent = new Date(ultima.createdAt).toLocaleTimeString("pt-BR");

    const soma = valores.reduce((total, valor) => total + valor, 0);
    media.textContent = (soma / valores.length).toFixed(2);
    maximo.textContent = Math.max(...valores);
    minimo.textContent = Math.min(...valores);

    atualizarTendencia(valores);
    atualizarEstado(ultima.classification);
    renderizarHistorico(ultimas);
    desenharGrafico(ultimas);
}

function atualizarTendencia(valores) {
    if (valores.length < 2) {
        tendencia.textContent = "Estável";
        return;
    }

    const atual = valores[valores.length - 1];
    const anterior = valores[valores.length - 2];

    if (atual > anterior) {
        tendencia.textContent = "↑ Crescendo";
    }
    else if (atual < anterior) {
        tendencia.textContent = "↓ Diminuindo";
    }
    else {
        tendencia.textContent = "→ Estável";
    }
}

function atualizarEstado(classe) {
    cardClassificacao.classList.remove(
        "estado-escuro",
        "estado-adequado",
        "estado-muito-iluminado"
    );

    if (classe === "Escuro") {
        cardClassificacao.classList.add("estado-escuro");
    }
    else if (classe === "Adequado") {
        cardClassificacao.classList.add("estado-adequado");
    }
    else if (classe === "Muito_Iluminado") {
        cardClassificacao.classList.add("estado-muito-iluminado");
    }
}

function renderizarHistorico(ultimas) {
    historico.innerHTML = "";

    ultimas
        .slice()
        .reverse()
        .forEach(medicao => {
            const linha = document.createElement("tr");
            const confianca = Math.round(
                (medicao.probabilities?.[medicao.classification] ?? 0) * 100
            );

            linha.innerHTML = `
                <td>${new Date(medicao.createdAt).toLocaleTimeString("pt-BR")}</td>
                <td>${medicao.sample[0]}</td>
                <td><span class="badge ${medicao.classification}">${medicao.classification}</span></td>
                <td>${confianca}%</td>
            `;

            historico.appendChild(linha);
        });
}

function desenharGrafico(ultimas) {
    const ctx = canvas.getContext("2d");
    const largura = canvas.clientWidth || 900;
    const altura = 300;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    if (ultimas.length < 2) {
        ctx.fillStyle = "#667085";
        ctx.font = "14px Arial";
        ctx.fillText("Aguardando mais medições para desenhar o gráfico...", 20, 40);
        return;
    }

    const margem = 40;
    const larguraUtil = largura - margem * 2;
    const alturaUtil = altura - margem * 2;
    const valores = ultimas.map(medicao => medicao.sample[0]);
    const maxValor = 4095;

    ctx.strokeStyle = "#d0d5dd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margem, margem);
    ctx.lineTo(margem, altura - margem);
    ctx.lineTo(largura - margem, altura - margem);
    ctx.stroke();

    ctx.fillStyle = "#667085";
    ctx.font = "12px Arial";
    ctx.fillText("4095", 5, margem + 4);
    ctx.fillText("0", 20, altura - margem + 4);

    ctx.strokeStyle = "#155eef";
    ctx.lineWidth = 2;
    ctx.beginPath();

    ultimas.forEach((medicao, indice) => {
        const x = margem + (indice / (ultimas.length - 1)) * larguraUtil;
        const y = altura - margem - (medicao.sample[0] / maxValor) * alturaUtil;

        if (indice === 0) {
            ctx.moveTo(x, y);
        }
        else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();
}

carregarMedicoes();
setInterval(carregarMedicoes, 1000);
window.addEventListener("resize", renderizar);
