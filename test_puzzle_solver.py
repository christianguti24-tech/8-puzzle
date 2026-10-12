"""
Pruebas unitarias para el algoritmo de búsqueda A* y la lógica del 8-Puzzle.
"""

import unittest
from puzzle_solver import (
    GOAL_STATE,
    count_inversions,
    is_solvable,
    heuristic_misplaced,
    get_neighbors,
    solve_puzzle,
)


class Test8PuzzleSolver(unittest.TestCase):

    def test_tablero_ya_resuelto(self):
        """Comprueba el comportamiento cuando el tablero inicial ya es el objetivo."""
        initial = (1, 2, 3, 4, 5, 6, 7, 8, 0)
        result = solve_puzzle(initial)

        self.assertTrue(result["solvable"])
        self.assertTrue(result["success"])
        self.assertEqual(result["cost"], 0)
        self.assertEqual(result["moves"], [])
        self.assertEqual(result["solution_path"], [initial])
        self.assertEqual(result["nodes_expanded_count"], 1)
        self.assertEqual(result["statistics"]["moves_count"], 0)
        self.assertEqual(result["statistics"]["inversions"], 0)

    def test_tablero_un_movimiento(self):
        """Comprueba la resolución de un tablero a exactamente 1 movimiento del objetivo."""
        # El 0 está en la posición 7 (abajo-centro) y debe moverse a la derecha
        initial = (1, 2, 3, 4, 5, 6, 7, 0, 8)
        result = solve_puzzle(initial)

        self.assertTrue(result["solvable"])
        self.assertTrue(result["success"])
        self.assertEqual(result["cost"], 1)
        self.assertEqual(result["moves"], ["derecha"])
        self.assertEqual(result["solution_path"], [initial, GOAL_STATE])
        self.assertGreaterEqual(result["nodes_expanded_count"], 1)
        self.assertEqual(result["statistics"]["moves_count"], 1)

    def test_tablero_varios_movimientos(self):
        """Comprueba la resolución de tableros que requieren múltiples movimientos."""
        # Caso A: Tablero a 2 movimientos (0 en la esquina inferior izquierda: derecha, derecha)
        initial_2 = (1, 2, 3, 4, 5, 6, 0, 7, 8)
        result_2 = solve_puzzle(initial_2)

        self.assertTrue(result_2["solvable"])
        self.assertTrue(result_2["success"])
        self.assertEqual(result_2["cost"], 2)
        self.assertEqual(result_2["moves"], ["derecha", "derecha"])
        self.assertEqual(len(result_2["solution_path"]), 3)
        self.assertEqual(result_2["solution_path"][-1], GOAL_STATE)

        # Caso B: Tablero a 3 movimientos (0 en la posición 3: derecha, abajo, derecha)
        initial_3 = (1, 2, 3, 0, 4, 6, 7, 5, 8)
        result_3 = solve_puzzle(initial_3)

        self.assertTrue(result_3["solvable"])
        self.assertTrue(result_3["success"])
        self.assertEqual(result_3["cost"], 3)
        self.assertEqual(result_3["moves"], ["derecha", "abajo", "derecha"])
        self.assertEqual(len(result_3["solution_path"]), 4)
        self.assertEqual(result_3["solution_path"][-1], GOAL_STATE)

    def test_tablero_imposible(self):
        """Comprueba que un tablero imposible sea detectado por paridad de inversiones sin iniciar búsqueda."""
        # Se intercambian las fichas 7 y 8, generando 1 inversión (impar frente a par del objetivo)
        initial = (1, 2, 3, 4, 5, 6, 8, 7, 0)
        inversions = count_inversions(initial)
        self.assertEqual(inversions % 2, 1)
        self.assertFalse(is_solvable(initial))

        result = solve_puzzle(initial)

        self.assertFalse(result["solvable"])
        self.assertFalse(result["success"])
        self.assertEqual(result["solution_path"], [])
        self.assertEqual(result["moves"], [])
        self.assertEqual(result["nodes_expanded_count"], 0)
        self.assertIn("paridad de inversiones", result["message"])

    def test_registro_de_busqueda_y_grafo(self):
        """Verifica que se registren estados, aristas, valores g, h, f y orden de expansión."""
        initial = (1, 2, 3, 4, 5, 6, 7, 0, 8)
        result = solve_puzzle(initial)

        # Verificar metadatos de nodos
        self.assertIn(initial, result["nodes"])
        self.assertIn(GOAL_STATE, result["nodes"])
        goal_node = result["nodes"][GOAL_STATE]
        self.assertEqual(goal_node["g"], 1)
        self.assertEqual(goal_node["h"], 0)
        self.assertEqual(goal_node["f"], 1)
        self.assertEqual(goal_node["parent"], initial)
        self.assertEqual(goal_node["action"], "derecha")

        # Verificar aristas
        edges = result["edges"]
        self.assertTrue(any(e["from"] == initial and e["to"] == GOAL_STATE and e["action"] == "derecha" for e in edges))

        # Verificar orden de expansión
        self.assertIn(initial, result["expansion_order"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
