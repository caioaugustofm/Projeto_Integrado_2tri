import sys #recebe a amostra enviada pelo node.js
import os #monta o caminho do dataset.csv
import csv #lê o dataset
import json #converte texto JSON em lista e cria a resposta

from sklearn.neighbors import KNeighborsClassifier

DATASET_PATH = os.path.join(os.path.dirname(__file__), "dataset.csv")
N_NEIGHBORS = 3


def carregar_dataset(caminho):
    X = []
    y = []

    with open(caminho, newline="", encoding="utf-8") as arquivo: #abre dataset
        leitor = csv.reader(arquivo)
        next(leitor) #primeira linha é só texto

        for linha in leitor:
            *caracteristicas, classe = linha
            X.append([float(valor) for valor in caracteristicas]) #converte valores
            y.append(classe)

    return X, y


def main(): #controla o funcionamento
    if len(sys.argv) < 2: #json faz o python
        print(json.dumps({"error": "amostra nao informada"}))
        return

    try:
        sample = json.loads(sys.argv[1]) #converte para lista
    except json.JSONDecodeError:
        print(json.dumps({"error": "amostra nao e um JSON valido"}))
        return

    if not isinstance(sample, list) or not all(isinstance(valor, (int, float)) for valor in sample): #valida tudo
        print(json.dumps({"error": "sample deve ser um array JSON de numeros"}))
        return

    X, y = carregar_dataset(DATASET_PATH)

    if len(sample) != len(X[0]): #ve se só tem um valor
        print(json.dumps({
            "error": f"sample deve possuir {len(X[0])} valor(es), recebeu {len(sample)}"
        }))
        return

    modelo = KNeighborsClassifier(n_neighbors=N_NEIGHBORS)
    modelo.fit(X, y)

    classificacao = modelo.predict([sample])[0]
    probabilidades_modelo = modelo.predict_proba([sample])[0] #faz a média dos três vizinhos

    probabilidades = { #cria dicionários para organizar 
        classe: float(probabilidade)
        for classe, probabilidade in zip(modelo.classes_, probabilidades_modelo)
    }

    print(json.dumps({ #vira json
        "classification": classificacao,
        "probabilities": probabilidades
    }))


if __name__ == "__main__":
    main()
