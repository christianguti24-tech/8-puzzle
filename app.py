from flask import Flask, jsonify, render_template, request
from puzzle_solver import (
    count_inversions,
    is_solvable,
    serialize_solution,
    solve_puzzle,
)

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/solve', methods=['POST'])
def api_solve():
    # 1. Validar que la petición sea JSON
    if not request.is_json:
        return jsonify({
            "error": "JSON inválido",
            "message": "La petición debe incluir el encabezado 'Content-Type: application/json' y un cuerpo JSON válido.",
        }), 400

    try:
        payload = request.get_json(silent=True)
    except Exception:
        payload = None

    if payload is None:
        return jsonify({
            "error": "JSON inválido",
            "message": "No se pudo interpretar el cuerpo de la petición como un JSON válido.",
        }), 400

    # 2. Extraer el tablero (soporta objeto con clave 'board' / 'initial_state' o lista directa)
    if isinstance(payload, dict):
        if "board" in payload:
            board = payload["board"]
        elif "initial_state" in payload:
            board = payload["initial_state"]
        else:
            return jsonify({
                "error": "Datos inválidos",
                "message": "El cuerpo JSON debe incluir el campo 'board' con la lista de 9 enteros.",
            }), 400
    elif isinstance(payload, list):
        board = payload
    else:
        return jsonify({
            "error": "Datos inválidos",
            "message": "El cuerpo debe ser un objeto JSON con el campo 'board' o una lista de 9 enteros.",
        }), 400

    # 3. Validar que sea una lista
    if not isinstance(board, list):
        return jsonify({
            "error": "Datos inválidos",
            "message": "El tablero debe ser una lista de enteros.",
        }), 400

    # 4. Validar longitud de exactamente 9 elementos
    if len(board) != 9:
        return jsonify({
            "error": "Datos inválidos",
            "message": f"El tablero debe contener exactamente 9 elementos, pero se recibieron {len(board)}.",
        }), 400

    # 5. Validar tipos de datos y rango (rechazando booleanos estrictamente)
    for idx, val in enumerate(board):
        if type(val) is not int:
            return jsonify({
                "error": "Datos inválidos",
                "message": (
                    f"El elemento en el índice {idx} es de tipo '{type(val).__name__}', "
                    "no se permiten booleanos ni otros tipos que no sean enteros puros."
                ),
            }), 400

        if val < 0 or val > 8:
            return jsonify({
                "error": "Datos inválidos",
                "message": f"El valor {val} en el índice {idx} está fuera del rango permitido (0 a 8).",
            }), 400

    # 6. Validar que cada entero del 0 al 8 aparezca exactamente una vez (sin repetidos ni ausentes)
    if set(board) != set(range(9)):
        return jsonify({
            "error": "Datos inválidos",
            "message": "El tablero debe contener cada uno de los números del 0 al 8 exactamente una vez sin repetirse.",
        }), 400

    initial_tuple = tuple(board)

    # 7. Comprobar resolubilidad antes de ejecutar A* (rechaza tableros imposibles sin iniciar la búsqueda)
    if not is_solvable(initial_tuple):
        inversions = count_inversions(initial_tuple)
        return jsonify({
            "error": "Tablero imposible de resolver",
            "message": (
                f"El tablero no tiene solución debido a la paridad de inversiones. "
                f"(Inversiones calculadas: {inversions}, paridad impar frente a paridad par del objetivo)."
            ),
            "solvable": False,
            "inversions": inversions,
        }), 422

    # 8. Ejecutar el solucionador A* y serializar la respuesta
    search_result = solve_puzzle(initial_tuple)
    serialized_response = serialize_solution(search_result)

    return jsonify(serialized_response), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)

