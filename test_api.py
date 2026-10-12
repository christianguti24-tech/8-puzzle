"""
Pruebas automatizadas para la API de Flask (/api/solve).
"""

import json
import unittest
from app import app
from puzzle_solver import GOAL_STATE


class TestApiSolve(unittest.TestCase):

    def setUp(self):
        """Configura el cliente de pruebas de Flask."""
        self.client = app.test_client()
        self.client.testing = True

    def test_ruta_raiz_get(self):
        """Verifica que la ruta GET / siga funcionando y sirva la plantilla HTML."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"8-Puzzle con B\xc3\xbasqueda A*", response.data)

    def test_tablero_resuelto(self):
        """Verifica la respuesta para un tablero que ya está en el estado objetivo."""
        payload = {"board": [1, 2, 3, 4, 5, 6, 7, 8, 0]}
        response = self.client.post('/api/solve', json=payload)

        self.assertEqual(response.status_code, 200)
        data = response.get_json()

        self.assertTrue(data["solvable"])
        self.assertTrue(data["success"])
        self.assertEqual(data["cost"], 0)
        self.assertEqual(data["moves"], [])
        self.assertEqual(data["solution_path"], [[1, 2, 3, 4, 5, 6, 7, 8, 0]])
        self.assertEqual(data["initial_state"], [1, 2, 3, 4, 5, 6, 7, 8, 0])
        self.assertEqual(data["goal_state"], [1, 2, 3, 4, 5, 6, 7, 8, 0])
        self.assertIn("1,2,3,4,5,6,7,8,0", data["nodes"])
        self.assertIn("statistics", data)
        self.assertEqual(data["statistics"]["moves_count"], 0)

    def test_tablero_valido_con_movimientos(self):
        """Verifica la resolución exitosa de un tablero válido que requiere movimientos."""
        payload = {"board": [1, 2, 3, 4, 5, 6, 7, 0, 8]}
        response = self.client.post('/api/solve', json=payload)

        self.assertEqual(response.status_code, 200)
        data = response.get_json()

        self.assertTrue(data["solvable"])
        self.assertTrue(data["success"])
        self.assertEqual(data["cost"], 1)
        self.assertEqual(data["moves"], ["derecha"])
        self.assertEqual(len(data["solution_path"]), 2)
        self.assertEqual(data["solution_path"][0], [1, 2, 3, 4, 5, 6, 7, 0, 8])
        self.assertEqual(data["solution_path"][1], list(GOAL_STATE))

        # Verificar serialización de nodos y aristas para reconstrucción de grafo
        initial_id = "1,2,3,4,5,6,7,0,8"
        goal_id = "1,2,3,4,5,6,7,8,0"
        self.assertIn(initial_id, data["nodes"])
        self.assertIn(goal_id, data["nodes"])

        # Comprobar metadatos del nodo objetivo
        goal_node = data["nodes"][goal_id]
        self.assertEqual(goal_node["parent_id"], initial_id)
        self.assertEqual(goal_node["action"], "derecha")
        self.assertEqual(goal_node["g"], 1)
        self.assertEqual(goal_node["h"], 0)
        self.assertEqual(goal_node["f"], 1)

        # Comprobar presencia de la arista en el grafo
        edges = data["edges"]
        self.assertTrue(any(e["from"] == initial_id and e["to"] == goal_id and e["action"] == "derecha" for e in edges))

    def test_tablero_imposible(self):
        """Verifica que un tablero imposible devuelva error 422 sin iniciar búsqueda."""
        # Fichas 7 y 8 invertidas (paridad de inversiones impar)
        payload = {"board": [1, 2, 3, 4, 5, 6, 8, 7, 0]}
        response = self.client.post('/api/solve', json=payload)

        self.assertEqual(response.status_code, 422)
        data = response.get_json()

        self.assertFalse(data["solvable"])
        self.assertIn("error", data)
        self.assertIn("paridad de inversiones", data["message"])
        self.assertEqual(data["inversions"], 1)

    def test_tablero_valores_repetidos(self):
        """Verifica que un tablero con valores repetidos sea rechazado con código 400."""
        payload = {"board": [1, 2, 3, 4, 5, 6, 7, 8, 8]}
        response = self.client.post('/api/solve', json=payload)

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    def test_tablero_valores_fuera_de_rango(self):
        """Verifica que un tablero con valores fuera del rango 0-8 sea rechazado con código 400."""
        payload = {"board": [1, 2, 3, 4, 5, 6, 7, 8, 9]}
        response = self.client.post('/api/solve', json=payload)

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("fuera del rango", data["message"])

    def test_tablero_con_booleanos(self):
        """Verifica que no se acepten valores booleanos en el tablero (código 400)."""
        payload = {"board": [1, 2, 3, 4, 5, 6, 7, 8, True]}
        response = self.client.post('/api/solve', json=payload)

        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("booleanos", data["message"].lower())

    def test_tablero_longitud_incorrecta(self):
        """Verifica que tableros con menos o más de 9 elementos sean rechazados con código 400."""
        # Menos de 9 elementos
        response_short = self.client.post('/api/solve', json={"board": [1, 2, 3, 4, 5, 6, 7, 8]})
        self.assertEqual(response_short.status_code, 400)
        self.assertIn("exactamente 9", response_short.get_json()["message"])

        # Más de 9 elementos
        response_long = self.client.post('/api/solve', json={"board": [1, 2, 3, 4, 5, 6, 7, 8, 0, 0]})
        self.assertEqual(response_long.status_code, 400)
        self.assertIn("exactamente 9", response_long.get_json()["message"])

    def test_cuerpo_no_json_valido(self):
        """Verifica que peticiones que no sean JSON válido o carezcan de encabezado sean rechazadas con 400."""
        # Cabecera incorrecta (texto plano)
        response_txt = self.client.post('/api/solve', data="1,2,3,4,5,6,7,8,0", content_type='text/plain')
        self.assertEqual(response_txt.status_code, 400)
        self.assertIn("JSON", response_txt.get_json()["error"])

        # JSON malformado
        response_malformed = self.client.post('/api/solve', data="{board: [1, 2, 3", content_type='application/json')
        self.assertEqual(response_malformed.status_code, 400)
        self.assertIn("JSON", response_malformed.get_json()["error"])

    def test_cuerpo_objeto_sin_campo_board(self):
        """Verifica que un JSON sin el campo 'board' ni 'initial_state' devuelva código 400."""
        response = self.client.post('/api/solve', json={"otro_campo": [1, 2, 3, 4, 5, 6, 7, 8, 0]})
        self.assertEqual(response.status_code, 400)
        self.assertIn("board", response.get_json()["message"])


if __name__ == '__main__':
    unittest.main(verbosity=2)
