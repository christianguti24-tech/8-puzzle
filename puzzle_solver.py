"""
Módulo de lógica y resolución del 8-Puzzle utilizando el algoritmo de búsqueda A*.
"""

from __future__ import annotations
import heapq
from typing import Any, Dict, List, Optional, Set, Tuple

# Estado objetivo estándar para el 8-Puzzle
GOAL_STATE: Tuple[int, ...] = (1, 2, 3, 4, 5, 6, 7, 8, 0)

# Movimientos legales del espacio vacío (0)
# (desplazamiento de índice en la tupla plana de 9 elementos: fila * 3 + col)
MOVEMENTS: Dict[str, int] = {
    "arriba": -3,
    "abajo": 3,
    "izquierda": -1,
    "derecha": 1,
}


def validate_board(board: Tuple[int, ...]) -> None:
    """Valida que el tablero sea una tupla de exactamente 9 enteros con valores del 0 al 8 sin duplicados."""
    if not isinstance(board, tuple):
        raise TypeError("El tablero debe ser una tupla de 9 enteros.")
    if len(board) != 9:
        raise ValueError(f"El tablero debe contener exactamente 9 elementos, se recibieron {len(board)}.")
    if set(board) != set(range(9)):
        raise ValueError("El tablero debe contener todos los números del 0 al 8 sin duplicados.")


def count_inversions(state: Tuple[int, ...]) -> int:
    """
    Cuenta la cantidad de inversiones en el tablero, ignorando el espacio vacío (0).
    Una inversión ocurre cuando una ficha con un número mayor precede a una ficha con un número menor.
    """
    tiles = [tile for tile in state if tile != 0]
    inversions = 0
    for i in range(len(tiles)):
        for j in range(i + 1, len(tiles)):
            if tiles[i] > tiles[j]:
                inversions += 1
    return inversions


def is_solvable(state: Tuple[int, ...], goal: Tuple[int, ...] = GOAL_STATE) -> bool:
    """
    Determina si un estado es alcanzable hacia el objetivo según la paridad de inversiones.
    Para una cuadrícula 3x3 (ancho impar), un estado es resoluble si y solo si la paridad
    de sus inversiones coincide con la del estado objetivo (0 inversiones en GOAL_STATE, paridad par).
    """
    validate_board(state)
    validate_board(goal)
    return (count_inversions(state) % 2) == (count_inversions(goal) % 2)


def heuristic_misplaced(state: Tuple[int, ...], goal: Tuple[int, ...] = GOAL_STATE) -> int:
    """
    Calcula h(n): cantidad de fichas fuera de su posición objetivo, sin contar el espacio vacío.
    """
    return sum(1 for i in range(len(state)) if state[i] != 0 and state[i] != goal[i])


def get_neighbors(state: Tuple[int, ...]) -> List[Tuple[str, Tuple[int, ...]]]:
    """
    Genera los sucesores legales moviendo el espacio vacío (0).
    Retorna una lista de tuplas (acción, nuevo_estado).
    Acciones posibles: 'arriba', 'abajo', 'izquierda', 'derecha'.
    """
    blank_idx = state.index(0)
    row, col = blank_idx // 3, blank_idx % 3
    neighbors: List[Tuple[str, Tuple[int, ...]]] = []

    # Movimiento hacia arriba
    if row > 0:
        target_idx = blank_idx - 3
        new_state = list(state)
        new_state[blank_idx], new_state[target_idx] = new_state[target_idx], new_state[blank_idx]
        neighbors.append(("arriba", tuple(new_state)))

    # Movimiento hacia abajo
    if row < 2:
        target_idx = blank_idx + 3
        new_state = list(state)
        new_state[blank_idx], new_state[target_idx] = new_state[target_idx], new_state[blank_idx]
        neighbors.append(("abajo", tuple(new_state)))

    # Movimiento hacia la izquierda
    if col > 0:
        target_idx = blank_idx - 1
        new_state = list(state)
        new_state[blank_idx], new_state[target_idx] = new_state[target_idx], new_state[blank_idx]
        neighbors.append(("izquierda", tuple(new_state)))

    # Movimiento hacia la derecha
    if col < 2:
        target_idx = blank_idx + 1
        new_state = list(state)
        new_state[blank_idx], new_state[target_idx] = new_state[target_idx], new_state[blank_idx]
        neighbors.append(("derecha", tuple(new_state)))

    return neighbors


def solve_puzzle(
    initial_state: Tuple[int, ...],
    goal_state: Tuple[int, ...] = GOAL_STATE
) -> Dict[str, Any]:
    """
    Ejecuta el algoritmo de búsqueda A* para resolver el 8-Puzzle.
    
    Registra el historial completo de búsqueda (estados descubiertos y expandidos,
    padre, acción, valores g, h, f, aristas y orden de expansión).
    """
    validate_board(initial_state)
    validate_board(goal_state)

    inversions = count_inversions(initial_state)
    solvable = is_solvable(initial_state, goal_state)
    initial_h = heuristic_misplaced(initial_state, goal_state)

    # Detección previa de tableros imposibles de resolver
    if not solvable:
        return {
            "solvable": False,
            "success": False,
            "message": (
                f"El tablero no tiene solución debido a la paridad de inversiones. "
                f"(Inversiones={inversions}, paridad impar frente a paridad par del objetivo)."
            ),
            "initial_state": initial_state,
            "goal_state": goal_state,
            "solution_path": [],
            "moves": [],
            "cost": 0,
            "nodes_expanded_count": 0,
            "nodes_discovered_count": 1,
            "expansion_order": [],
            "nodes": {
                initial_state: {
                    "state": initial_state,
                    "parent": None,
                    "action": None,
                    "g": 0,
                    "h": initial_h,
                    "f": initial_h,
                    "expanded": False,
                    "expansion_step": None,
                }
            },
            "edges": [],
            "statistics": {
                "moves_count": 0,
                "nodes_expanded": 0,
                "nodes_discovered": 1,
                "inversions": inversions,
                "initial_h": initial_h,
                "max_frontier_size": 0,
            },
        }

    # Registro del menor costo g conocido para cada estado
    cost_so_far: Dict[Tuple[int, ...], int] = {initial_state: 0}

    # Registro de metadatos de nodos para trazabilidad y visualización posterior
    nodes_record: Dict[Tuple[int, ...], Dict[str, Any]] = {
        initial_state: {
            "state": initial_state,
            "parent": None,
            "action": None,
            "g": 0,
            "h": initial_h,
            "f": initial_h,
            "expanded": False,
            "expansion_step": None,
        }
    }

    edges_record: List[Dict[str, Any]] = []
    seen_edges: Set[Tuple[Tuple[int, ...], Tuple[int, ...]]] = set()

    # Cola de prioridad: tupla (f, h, counter, state)
    # h actúa como segundo criterio de desempate (prioriza nodos más cercanos al objetivo)
    counter = 0
    open_heap: List[Tuple[int, int, int, Tuple[int, ...]]] = [
        (initial_h, initial_h, counter, initial_state)
    ]

    closed_set: Set[Tuple[int, ...]] = set()
    expansion_order: List[Tuple[int, ...]] = []
    max_frontier_size = 1
    goal_found = False

    while open_heap:
        f_val, h_val, _, current = heapq.heappop(open_heap)

        # Evita volver a expandir estados ya cerrados
        if current in closed_set:
            continue

        closed_set.add(current)
        expansion_order.append(current)
        nodes_record[current]["expanded"] = True
        nodes_record[current]["expansion_step"] = len(expansion_order)

        # Comprobar si alcanzamos el estado objetivo
        if current == goal_state:
            goal_found = True
            break

        current_g = cost_so_far[current]

        # Explorar movimientos legales
        for action, neighbor in get_neighbors(current):
            tentative_g = current_g + 1

            # Registrar arista en el grafo de búsqueda
            edge_key = (current, neighbor)
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                edges_record.append({
                    "from": current,
                    "to": neighbor,
                    "action": action,
                    "cost": 1,
                })

            # Evita registrar o expandir sucesores con costo igual o peor
            if neighbor in cost_so_far and tentative_g >= cost_so_far[neighbor]:
                continue

            cost_so_far[neighbor] = tentative_g
            neighbor_h = heuristic_misplaced(neighbor, goal_state)
            neighbor_f = tentative_g + neighbor_h

            # Registrar o actualizar metadatos del estado sucesor
            nodes_record[neighbor] = {
                "state": neighbor,
                "parent": current,
                "action": action,
                "g": tentative_g,
                "h": neighbor_h,
                "f": neighbor_f,
                "expanded": False,
                "expansion_step": None,
            }

            counter += 1
            heapq.heappush(open_heap, (neighbor_f, neighbor_h, counter, neighbor))
            if len(open_heap) > max_frontier_size:
                max_frontier_size = len(open_heap)

    # Reconstrucción de la ruta de solución desde el objetivo hasta el inicio
    solution_path: List[Tuple[int, ...]] = []
    moves: List[str] = []

    if goal_found:
        curr: Optional[Tuple[int, ...]] = goal_state
        while curr is not None:
            solution_path.append(curr)
            parent = nodes_record[curr]["parent"]
            act = nodes_record[curr]["action"]
            if act is not None:
                moves.append(act)
            curr = parent

        solution_path.reverse()
        moves.reverse()

    return {
        "solvable": True,
        "success": goal_found,
        "message": "Solución encontrada exitosamente." if goal_found else "No se encontró solución.",
        "initial_state": initial_state,
        "goal_state": goal_state,
        "solution_path": solution_path,
        "moves": moves,
        "cost": len(moves),
        "nodes_expanded_count": len(closed_set),
        "nodes_discovered_count": len(nodes_record),
        "expansion_order": expansion_order,
        "nodes": nodes_record,
        "edges": edges_record,
        "statistics": {
            "moves_count": len(moves),
            "nodes_expanded": len(closed_set),
            "nodes_discovered": len(nodes_record),
            "inversions": inversions,
            "initial_h": initial_h,
            "max_frontier_size": max_frontier_size,
        },
    }


def state_to_id(state: Tuple[int, ...]) -> str:
    """Convierte un estado representado como tupla a un identificador único y estable en formato cadena."""
    return ",".join(str(val) for val in state)


def serialize_solution(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convierte el resultado retornado por solve_puzzle a una estructura 100% serializable a JSON.
    Convierte tuplas a listas/cadenas y asigna identificadores estables a cada estado.
    """
    initial_state = result["initial_state"]
    goal_state = result["goal_state"]

    # Serializar nodos: mapeo de identificador de estado -> detalles del nodo
    serialized_nodes: Dict[str, Dict[str, Any]] = {}
    for state_tuple, node_info in result.get("nodes", {}).items():
        sid = state_to_id(state_tuple)
        parent_tuple = node_info.get("parent")
        parent_id = state_to_id(parent_tuple) if parent_tuple is not None else None

        serialized_nodes[sid] = {
            "id": sid,
            "state": list(state_tuple),
            "parent_id": parent_id,
            "action": node_info.get("action"),
            "g": node_info.get("g"),
            "h": node_info.get("h"),
            "f": node_info.get("f"),
            "expanded": node_info.get("expanded", False),
            "expansion_step": node_info.get("expansion_step"),
        }

    # Serializar aristas: identificadores estables para 'from' y 'to'
    serialized_edges: List[Dict[str, Any]] = []
    for edge in result.get("edges", []):
        serialized_edges.append({
            "from": state_to_id(edge["from"]),
            "to": state_to_id(edge["to"]),
            "action": edge.get("action"),
            "cost": edge.get("cost", 1),
        })

    # Serializar ruta de solución y orden de expansión
    solution_path_serialized = [list(state) for state in result.get("solution_path", [])]
    solution_path_ids = [state_to_id(state) for state in result.get("solution_path", [])]
    expansion_order_ids = [state_to_id(state) for state in result.get("expansion_order", [])]

    return {
        "solvable": result.get("solvable", True),
        "success": result.get("success", True),
        "message": result.get("message", ""),
        "initial_state": list(initial_state),
        "goal_state": list(goal_state),
        "initial_state_id": state_to_id(initial_state),
        "goal_state_id": state_to_id(goal_state),
        "solution_path": solution_path_serialized,
        "solution_path_ids": solution_path_ids,
        "moves": result.get("moves", []),
        "cost": result.get("cost", 0),
        "nodes_expanded_count": result.get("nodes_expanded_count", 0),
        "nodes_discovered_count": result.get("nodes_discovered_count", 0),
        "expansion_order": expansion_order_ids,
        "nodes": serialized_nodes,
        "edges": serialized_edges,
        "statistics": result.get("statistics", {}),
    }

