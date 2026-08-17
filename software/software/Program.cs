using System;
using System.IO.Ports;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

class Program
{
    static readonly HttpClient cliente = new HttpClient();

    static async Task Main()
    {
        Console.OutputEncoding = Encoding.UTF8;

        Console.Write("Digite a porta do STM32: ");
        string nomePorta = Console.ReadLine()!;

        SerialPort portaSerial = new SerialPort
        {
            PortName = nomePorta,
            BaudRate = 115200,
            Parity = Parity.None,
            DataBits = 8,
            StopBits = StopBits.One,
            NewLine = "\n",
            ReadTimeout = 2000
        };

        try
        {
            portaSerial.Open();

            Console.WriteLine($"{nomePorta} aberta com sucesso.");
            Console.WriteLine("Aguardando valores do STM32...\n");

            while (true)
            {
                try
                {
                    string linha = portaSerial.ReadLine().Trim();

                    if (!int.TryParse(linha, out int valor))
                    {
                        Console.WriteLine($"Valor inválido recebido: {linha}");
                        continue;
                    }

                    Console.WriteLine($"Valor recebido do STM32: {valor}");

                    var dados = new
                    {
                        sample = new[] { valor }
                    };

                    HttpResponseMessage resposta = await cliente.PostAsJsonAsync(
                        "http://localhost:3000/medicoes",
                        dados
                    );

                    string conteudo = await resposta.Content.ReadAsStringAsync();

                    if (!resposta.IsSuccessStatusCode)
                    {
                        Console.WriteLine($"Erro do servidor: {conteudo}\n");
                        continue;
                    }

                    using JsonDocument json = JsonDocument.Parse(conteudo);

                    string classificacao = json.RootElement
                        .GetProperty("classification")
                        .GetString() ?? "Sem classificação";

                    Console.WriteLine($"Classificação: {classificacao}");
                    Console.WriteLine("----------------------------------");
                }
                catch (TimeoutException)
                {
                    // Nenhum valor foi recebido dentro do tempo limite.
                }
                catch (HttpRequestException erro)
                {
                    Console.WriteLine($"Erro ao acessar o servidor: {erro.Message}");
                    Console.WriteLine("Verifique se o Node.js está rodando.\n");
                    await Task.Delay(2000);
                }
                catch (JsonException erro)
                {
                    Console.WriteLine($"Resposta JSON inválida: {erro.Message}\n");
                }
            }
        }
        catch (UnauthorizedAccessException)
        {
            Console.WriteLine($"A {nomePorta} está sendo usada por outro programa.");
            Console.WriteLine("Feche o PuTTY ou outro monitor serial.");
        }
        catch (Exception erro)
        {
            Console.WriteLine($"Erro: {erro.Message}");
        }
        finally
        {
            if (portaSerial.IsOpen)
            {
                portaSerial.Close();
            }
        }
    }
}