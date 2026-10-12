/**
 * 8-Puzzle con Búsqueda A* - Cliente Web Interactivo
 * Módulo para control del tablero, conexión a la API Flask,
 * reproducción paso a paso, visualización del grafo en SVG y panel didáctico.
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // Constantes y Estado de la Aplicación
    // -------------------------------------------------------------------------
    const GOAL_STATE = [1, 2, 3, 4, 5, 6, 7, 8, 0];

    // Estado inicial por defecto (a 1 movimiento del objetivo para prueba inmediata)
    let currentBoard = [1, 2, 3, 4, 5, 6, 7, 0, 8];
    let initialBoardBackup = [...currentBoard];

    // Datos de la última solución recibida de la API
    let solutionData = null;
    let currentStep = 0;
    let playbackTimer = null;
    let isSolving = false;
    let clientSearchTimeMs = null;

    // -------------------------------------------------------------------------
    // Referencias a Elementos del DOM
    // -------------------------------------------------------------------------
    const boardEl = document.getElementById('puzzle-board');
    const statusBadgeEl = document.getElementById('status-badge');
    const alertBannerEl = document.getElementById('alert-banner');
    const alertIconEl = document.getElementById('alert-icon');
    const alertTextEl = document.getElementById('alert-text');

    const btnRandom = document.getElementById('btn-random');
    const btnSolve = document.getElementById('btn-solve');
    const btnReset = document.getElementById('btn-reset');

    const btnFirst = document.getElementById('btn-first');
    const btnPrev = document.getElementById('btn-prev');
    const btnPlay = document.getElementById('btn-play');
    const btnNext = document.getElementById('btn-next');
    const btnLast = document.getElementById('btn-last');
    const speedSelect = document.getElementById('speed-select');

    const stepCounterEl = document.getElementById('step-counter');
    const progressBarEl = document.getElementById('progress-bar');
    const metricActionEl = document.getElementById('metric-action');
    const metricGEl = document.getElementById('metric-g');
    const metricHEl = document.getElementById('metric-h');
    const metricFEl = document.getElementById('metric-f');

    const graphSvgEl = document.getElementById('search-graph-svg');
    const graphNodeLimitEl = document.getElementById('graph-node-limit');
    const graphWarningEl = document.getElementById('graph-warning');
    const graphVisibleCountEl = document.getElementById('graph-visible-count');
    const graphTotalCountEl = document.getElementById('graph-total-count');

    const statCostEl = document.getElementById('stat-cost');
    const statExpandedEl = document.getElementById('stat-expanded');
    const statDiscoveredEl = document.getElementById('stat-discovered');
    const statFrontierEl = document.getElementById('stat-frontier');
    const statInversionsEl = document.getElementById('stat-inversions');
    const statTimeClientEl = document.getElementById('stat-time-client');
    const liveExplanationEl = document.getElementById('live-explanation-text');

    // -------------------------------------------------------------------------
    // Funciones Matemáticas Auxiliares
    // -------------------------------------------------------------------------
    function stateToId(board) {
        return board.join(',');
    }

    function countInversions(board) {
        const tiles = board.filter(val => val !== 0);
        let inv = 0;
        for (let i = 0; i < tiles.length; i++) {
            for (let j = i + 1; j < tiles.length; j++) {
                if (tiles[i] > tiles[j]) inv++;
            }
        }
        return inv;
    }

    function isSolvable(board) {
        return countInversions(board) % 2 === 0;
    }

    function getMovableIndices(blankIdx) {
        const row = Math.floor(blankIdx / 3);
        const col = blankIdx % 3;
        const movables = [];

        if (row > 0) movables.push(blankIdx - 3); // Arriba
        if (row < 2) movables.push(blankIdx + 3); // Abajo
        if (col > 0) movables.push(blankIdx - 1); // Izquierda
        if (col < 2) movables.push(blankIdx + 1); // Derecha

        return movables;
    }

    // -------------------------------------------------------------------------
    // Renderizado del Tablero Interactivo
    // -------------------------------------------------------------------------
    function renderBoard() {
        boardEl.innerHTML = '';
        const blankIdx = currentBoard.indexOf(0);
        const movableIndices = getMovableIndices(blankIdx);
        const interactive = !isSolving && (solutionData === null || playbackTimer === null);

        currentBoard.forEach((val, idx) => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.setAttribute('role', 'gridcell');

            if (val === 0) {
                tile.classList.add('tile-empty');
                tile.textContent = '0';
                tile.setAttribute('aria-label', 'Espacio vacío');
            } else {
                tile.textContent = val;
                tile.setAttribute('aria-label', `Ficha número ${val}`);

                if (interactive && movableIndices.includes(idx)) {
                    tile.classList.add('tile-movable');
                    tile.title = 'Haz clic para mover esta ficha al espacio vacío';
                    tile.addEventListener('click', () => onTileClick(idx));
                }
            }

            boardEl.appendChild(tile);
        });
    }

    function onTileClick(tileIdx) {
        const blankIdx = currentBoard.indexOf(0);
        const movableIndices = getMovableIndices(blankIdx);

        if (!movableIndices.includes(tileIdx)) return;

        // Intercambiar posición de la ficha y el espacio vacío
        [currentBoard[tileIdx], currentBoard[blankIdx]] = [currentBoard[blankIdx], currentBoard[tileIdx]];

        // Limpiar cualquier solución previa ya que el estado fue modificado manualmente
        clearSolutionState();
        initialBoardBackup = [...currentBoard];

        renderBoard();
        showAlert('Ficha movida manualmente. Pulsa "Resolver con A*" para calcular la nueva ruta.', 'info');
    }

    // -------------------------------------------------------------------------
    // Alertas y Mensajes
    // -------------------------------------------------------------------------
    function showAlert(message, type = 'info') {
        alertBannerEl.className = 'alert-banner';
        if (type === 'danger') {
            alertBannerEl.classList.add('alert-danger');
            alertIconEl.textContent = '⚠️';
        } else if (type === 'success') {
            alertBannerEl.classList.add('alert-success');
            alertIconEl.textContent = '✅';
        } else {
            alertBannerEl.classList.add('alert-info');
            alertIconEl.textContent = 'ℹ️';
        }
        alertTextEl.textContent = message;
    }

    function hideAlert() {
        alertBannerEl.className = 'alert-banner hidden';
        alertTextEl.textContent = '';
    }

    function setStatusBadge(text, type = 'idle') {
        statusBadgeEl.className = 'badge';
        if (type === 'loading') statusBadgeEl.classList.add('badge-loading');
        else if (type === 'success') statusBadgeEl.classList.add('badge-success');
        else if (type === 'error') statusBadgeEl.classList.add('badge-error');
        else statusBadgeEl.classList.add('badge-idle');
        statusBadgeEl.textContent = text;
    }

    // -------------------------------------------------------------------------
    // Generación de Tablero Resoluble Aleatorio
    // -------------------------------------------------------------------------
    function generateRandomSolvableBoard() {
        if (isSolving) return;
        pausePlayback();

        // Partimos del estado objetivo y aplicamos 25 movimientos aleatorios legales del espacio vacío
        // Esto garantiza al 100% que el estado generado tiene solución
        let board = [...GOAL_STATE];
        let lastBlank = -1;

        for (let step = 0; step < 26; step++) {
            const blank = board.indexOf(0);
            const movables = getMovableIndices(blank).filter(idx => idx !== lastBlank);
            const chosen = movables.length > 0 ? movables[Math.floor(Math.random() * movables.length)] : getMovableIndices(blank)[0];

            [board[blank], board[chosen]] = [board[chosen], board[blank]];
            lastBlank = blank;
        }

        // Si por azar coincidió con el objetivo, movemos una ficha más
        if (board.every((v, i) => v === GOAL_STATE[i])) {
            const blank = board.indexOf(0);
            const movables = getMovableIndices(blank);
            const chosen = movables[0];
            [board[blank], board[chosen]] = [board[chosen], board[blank]];
        }

        currentBoard = board;
        initialBoardBackup = [...currentBoard];
        clearSolutionState();

        const inv = countInversions(currentBoard);
        renderBoard();
        setStatusBadge('Listo', 'idle');
        showAlert(`Tablero aleatorio generado con solución garantizada (Inversiones: ${inv}, paridad par).`, 'info');
    }

    // -------------------------------------------------------------------------
    // Llamada a la API /api/solve
    // -------------------------------------------------------------------------
    async function solveCurrentBoard() {
        if (isSolving) return;
        pausePlayback();
        isSolving = true;

        // Deshabilitar controles mientras se consulta la API
        btnSolve.disabled = true;
        btnRandom.disabled = true;
        btnReset.disabled = true;
        setStatusBadge('Buscando con A*...', 'loading');
        showAlert('Enviando tablero a Flask y calculando solución con A*...', 'info');

        const startTime = performance.now();

        try {
            const response = await fetch('/api/solve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ board: currentBoard }),
            });

            clientSearchTimeMs = Math.round(performance.now() - startTime);
            const data = await response.json();

            if (response.status === 200) {
                solutionData = data;
                currentStep = 0;
                setStatusBadge('Solucionado', 'success');

                if (solutionData.cost === 0) {
                    showAlert('¡El tablero ya está en el estado objetivo! Se requirieron 0 movimientos.', 'success');
                } else {
                    showAlert(`¡Solución óptima encontrada! ${solutionData.cost} movimientos calculados en ${solutionData.nodes_expanded_count} expansiones.`, 'success');
                }

                updatePlaybackUI();
                updateStatsPanel();
                renderGraph();
                updateLiveExplanation();
            } else if (response.status === 422) {
                // Tablero imposible de resolver
                clearSolutionState();
                setStatusBadge('Sin solución', 'error');
                showAlert(data.message || 'El tablero es matemáticamente imposible de resolver por paridad de inversiones.', 'danger');
            } else {
                // Error de datos (400) u otro
                clearSolutionState();
                setStatusBadge('Error', 'error');
                showAlert(data.message || 'Error en los datos de entrada enviado a la API.', 'danger');
            }
        } catch (err) {
            console.error('Error de conexión con la API:', err);
            clientSearchTimeMs = null;
            clearSolutionState();
            setStatusBadge('Fallo de red', 'error');
            showAlert('No se pudo conectar con el servidor Flask (/api/solve). Verifica que el servidor esté activo.', 'danger');
        } finally {
            isSolving = false;
            btnSolve.disabled = false;
            btnRandom.disabled = false;
            btnReset.disabled = false;
            renderBoard();
        }
    }

    // -------------------------------------------------------------------------
    // Control de Reproducción Paso a Paso
    // -------------------------------------------------------------------------
    function clearSolutionState() {
        pausePlayback();
        solutionData = null;
        currentStep = 0;
        updatePlaybackUI();
        clearStatsPanel();
        renderEmptyGraph();
        liveExplanationEl.textContent = 'Tablero modificado o en espera de resolución. Pulsa "Resolver con A*" para generar la solución y ver el análisis.';
    }

    function updatePlaybackUI() {
        if (!solutionData || !solutionData.solution_path) {
            stepCounterEl.textContent = 'Paso 0 de 0';
            progressBarEl.style.width = '0%';
            btnFirst.disabled = true;
            btnPrev.disabled = true;
            btnPlay.disabled = true;
            btnNext.disabled = true;
            btnLast.disabled = true;

            metricActionEl.textContent = '-';
            metricGEl.textContent = '0';
            metricHEl.textContent = '0';
            metricFEl.textContent = '0';
            return;
        }

        const totalSteps = solutionData.solution_path.length;
        stepCounterEl.textContent = `Paso ${currentStep} de ${totalSteps - 1}`;

        const progressPercent = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;
        progressBarEl.style.width = `${progressPercent}%`;

        btnFirst.disabled = currentStep === 0;
        btnPrev.disabled = currentStep === 0;
        btnPlay.disabled = totalSteps <= 1;
        btnNext.disabled = currentStep === totalSteps - 1;
        btnLast.disabled = currentStep === totalSteps - 1;

        // Actualizar tablero al paso activo
        currentBoard = [...solutionData.solution_path[currentStep]];
        renderBoard();

        // Obtener datos del nodo para el paso activo
        const stateKey = stateToId(currentBoard);
        const nodeInfo = solutionData.nodes ? solutionData.nodes[stateKey] : null;

        if (currentStep === 0) {
            metricActionEl.textContent = 'Inicio';
        } else {
            metricActionEl.textContent = solutionData.moves[currentStep - 1] || '-';
        }

        if (nodeInfo) {
            metricGEl.textContent = nodeInfo.g;
            metricHEl.textContent = nodeInfo.h;
            metricFEl.textContent = nodeInfo.f;
        } else {
            metricGEl.textContent = currentStep;
            metricHEl.textContent = '-';
            metricFEl.textContent = '-';
        }

        highlightActiveGraphNode();
        updateLiveExplanation();
    }

    function goToStep(stepIndex) {
        if (!solutionData) return;
        const total = solutionData.solution_path.length;
        currentStep = Math.max(0, Math.min(stepIndex, total - 1));
        updatePlaybackUI();
    }

    function togglePlay() {
        if (playbackTimer !== null) {
            pausePlayback();
        } else {
            startPlayback();
        }
    }

    function startPlayback() {
        if (!solutionData || solutionData.solution_path.length <= 1) return;

        // Si ya estamos al final, reiniciar al paso 0
        if (currentStep >= solutionData.solution_path.length - 1) {
            currentStep = 0;
            updatePlaybackUI();
        }

        btnPlay.textContent = '⏸';
        btnPlay.title = 'Pausar';
        const delay = parseInt(speedSelect.value, 10) || 700;

        playbackTimer = setInterval(() => {
            if (currentStep < solutionData.solution_path.length - 1) {
                goToStep(currentStep + 1);
            } else {
                pausePlayback();
            }
        }, delay);
    }

    function pausePlayback() {
        if (playbackTimer !== null) {
            clearInterval(playbackTimer);
            playbackTimer = null;
        }
        btnPlay.textContent = '▶';
        btnPlay.title = 'Reproducir automáticamente';
    }

    // -------------------------------------------------------------------------
    // Panel de Estadísticas Reales
    // -------------------------------------------------------------------------
    function updateStatsPanel() {
        if (!solutionData) {
            clearStatsPanel();
            return;
        }

        statCostEl.textContent = `${solutionData.cost} pasos`;
        statExpandedEl.textContent = solutionData.nodes_expanded_count.toLocaleString();
        statDiscoveredEl.textContent = solutionData.nodes_discovered_count.toLocaleString();

        const stats = solutionData.statistics || {};
        statFrontierEl.textContent = stats.max_frontier_size ? stats.max_frontier_size.toLocaleString() : '-';
        statInversionsEl.textContent = stats.inversions !== undefined ? stats.inversions : countInversions(solutionData.initial_state);

        if (clientSearchTimeMs !== null) {
            statTimeClientEl.textContent = `${clientSearchTimeMs} ms`;
        } else {
            statTimeClientEl.textContent = 'No disponible';
        }
    }

    function clearStatsPanel() {
        statCostEl.textContent = '-';
        statExpandedEl.textContent = '-';
        statDiscoveredEl.textContent = '-';
        statFrontierEl.textContent = '-';
        statInversionsEl.textContent = '-';
        statTimeClientEl.textContent = '-';
    }

    // -------------------------------------------------------------------------
    // Explicación Didáctica Interactiva
    // -------------------------------------------------------------------------
    function updateLiveExplanation() {
        if (!solutionData) {
            liveExplanationEl.innerHTML = 'Aún no se ha ejecutado ninguna búsqueda. Selecciona un tablero y pulsa "Resolver con A*" para ver el análisis de cada paso.';
            return;
        }

        const totalSteps = solutionData.solution_path.length - 1;
        const stateKey = stateToId(currentBoard);
        const nodeInfo = solutionData.nodes ? solutionData.nodes[stateKey] : null;

        if (currentStep === 0) {
            const h = nodeInfo ? nodeInfo.h : 'desconocido';
            const f = nodeInfo ? nodeInfo.f : h;
            liveExplanationEl.innerHTML = `
                <strong>Estado Inicial (Paso 0):</strong> El algoritmo parte de este tablero sin movimientos acumulados (<strong>g(n) = 0</strong>).<br>
                La heurística cuenta que hay <strong>h(n) = ${h}</strong> ficha(s) fuera de su posición meta.<br>
                Por tanto, la evaluación inicial es <strong>f(n) = 0 + ${h} = ${f}</strong>. Este nodo se insertó en la cola de prioridad como punto de partida.
            `;
        } else if (currentStep === totalSteps) {
            const g = nodeInfo ? nodeInfo.g : currentStep;
            liveExplanationEl.innerHTML = `
                <strong>¡Estado Objetivo Alcanzado! (Paso ${currentStep}):</strong><br>
                Todas las fichas del 1 al 8 se encuentran en sus posiciones correctas, por lo que <strong>h(n) = 0</strong>.<br>
                El costo total exacto es <strong>g(n) = ${g}</strong> movimientos (óptimo).<br>
                Como la heurística de fichas fuera de lugar es admisible (nunca sobreestima), A* garantiza que no existe una solución más corta.
            `;
        } else {
            const action = solutionData.moves[currentStep - 1];
            const g = nodeInfo ? nodeInfo.g : currentStep;
            const h = nodeInfo ? nodeInfo.h : '-';
            const f = nodeInfo ? nodeInfo.f : '-';
            liveExplanationEl.innerHTML = `
                <strong>Paso ${currentStep} de la Solución:</strong><br>
                Se aplicó el movimiento <strong>'${action}'</strong> sobre el espacio vacío.<br>
                • <strong>g(n) = ${g}</strong>: Se han acumulado ${g} movimientos reales desde el inicio.<br>
                • <strong>h(n) = ${h}</strong>: Quedan ${h} ficha(s) fuera de su casilla meta.<br>
                • <strong>f(n) = g + h = ${f}</strong>: Costo total estimado del camino que pasa por este estado.<br>
                A* seleccionó expandir esta rama porque su valor de f(n) (${f}) era el menor disponible en la frontera en su momento de exploración.
            `;
        }
    }

    // -------------------------------------------------------------------------
    // Visualización del Grafo de Búsqueda (SVG)
    // -------------------------------------------------------------------------
    function renderEmptyGraph() {
        graphSvgEl.innerHTML = `
            <text x="400" y="220" text-anchor="middle" fill="#94a3b8" font-size="14">
                Presiona "Resolver con A*" para generar el grafo de búsqueda.
            </text>
        `;
        graphWarningEl.classList.add('hidden');
    }

    function renderGraph() {
        if (!solutionData || !solutionData.nodes) {
            renderEmptyGraph();
            return;
        }

        const limit = parseInt(graphNodeLimitEl.value, 10) || 40;
        const allNodeIds = Object.keys(solutionData.nodes);
        const totalNodesCount = allNodeIds.length;

        // Seleccionar qué nodos incluir en la visualización:
        // 1. Siempre incluir TODOS los nodos de la ruta de solución para no romper el camino
        const pathIds = new Set(solutionData.solution_path_ids || []);
        const visibleNodeIds = new Set(pathIds);

        // 2. Llenar los cupos restantes con los nodos según el orden de expansión
        const expansionOrder = solutionData.expansion_order || allNodeIds;
        for (const id of expansionOrder) {
            if (visibleNodeIds.size >= limit) break;
            visibleNodeIds.add(id);
        }

        // Mostrar advertencia si se están ocultando nodos
        if (totalNodesCount > visibleNodeIds.size) {
            graphWarningEl.classList.remove('hidden');
            graphVisibleCountEl.textContent = visibleNodeIds.size;
            graphTotalCountEl.textContent = totalNodesCount;
        } else {
            graphWarningEl.classList.add('hidden');
        }

        // Agrupar los nodos visibles por nivel de profundidad g
        const nodesByG = new Map();
        let maxG = 0;

        visibleNodeIds.forEach(id => {
            const node = solutionData.nodes[id];
            const g = node ? node.g : 0;
            if (g > maxG) maxG = g;
            if (!nodesByG.has(g)) nodesByG.set(g, []);
            nodesByG.get(g).push(id);
        });

        // Configuración de dimensiones del lienzo SVG
        const svgWidth = Math.max(800, (maxG + 1) * 160 + 100);
        const svgHeight = 460;
        graphSvgEl.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        graphSvgEl.innerHTML = '';

        // Definir marcadores de flecha en SVG
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <marker id="arrow-path" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>
            <marker id="arrow-other" viewBox="0 0 10 10" refX="20" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
            </marker>
        `;
        graphSvgEl.appendChild(defs);

        // Calcular coordenadas (x, y) para cada nodo
        const nodePositions = new Map();
        const startX = 70;
        const colSpacing = (svgWidth - 140) / Math.max(1, maxG);

        for (let g = 0; g <= maxG; g++) {
            const list = nodesByG.get(g) || [];
            const colX = startX + g * colSpacing;
            const count = list.length;
            const verticalSpacing = svgHeight / (count + 1);

            // Ordenar: poner primero el nodo que pertenece a la ruta de solución
            list.sort((a, b) => {
                const aPath = pathIds.has(a) ? 1 : 0;
                const bPath = pathIds.has(b) ? 1 : 0;
                return bPath - aPath;
            });

            list.forEach((id, index) => {
                const y = verticalSpacing * (index + 1);
                nodePositions.set(id, { x: colX, y });
            });
        }

        // Contenedor de aristas
        const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        edgesGroup.setAttribute('class', 'edges-layer');

        const renderedEdges = new Set();
        (solutionData.edges || []).forEach(edge => {
            if (visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)) {
                const edgeKey = `${edge.from}->${edge.to}`;
                if (renderedEdges.has(edgeKey)) return;
                renderedEdges.add(edgeKey);

                const p1 = nodePositions.get(edge.from);
                const p2 = nodePositions.get(edge.to);
                if (!p1 || !p2) return;

                const isPathEdge = pathIds.has(edge.from) && pathIds.has(edge.to);

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', p1.x);
                line.setAttribute('y1', p1.y);
                line.setAttribute('x2', p2.x);
                line.setAttribute('y2', p2.y);

                if (isPathEdge) {
                    line.setAttribute('stroke', '#10b981');
                    line.setAttribute('stroke-width', '2.5');
                    line.setAttribute('marker-end', 'url(#arrow-path)');
                } else {
                    line.setAttribute('stroke', '#334155');
                    line.setAttribute('stroke-width', '1.2');
                    line.setAttribute('stroke-dasharray', '3,3');
                    line.setAttribute('marker-end', 'url(#arrow-other)');
                }

                edgesGroup.appendChild(line);
            }
        });
        graphSvgEl.appendChild(edgesGroup);

        // Contenedor de nodos
        const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodesGroup.setAttribute('class', 'nodes-layer');

        visibleNodeIds.forEach(id => {
            const pos = nodePositions.get(id);
            if (!pos) return;

            const nodeData = solutionData.nodes[id] || {};
            const isPath = pathIds.has(id);

            const gNode = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            gNode.setAttribute('id', `graph-node-${id.replace(/,/g, '-')}`);
            gNode.setAttribute('class', 'graph-node-group');
            gNode.style.cursor = 'pointer';

            // Círculo del nodo
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pos.x);
            circle.setAttribute('cy', pos.y);
            circle.setAttribute('r', isPath ? '18' : '14');

            if (isPath) {
                circle.setAttribute('fill', '#064e3b');
                circle.setAttribute('stroke', '#10b981');
                circle.setAttribute('stroke-width', '2.5');
            } else {
                circle.setAttribute('fill', '#1e293b');
                circle.setAttribute('stroke', '#475569');
                circle.setAttribute('stroke-width', '1.5');
            }

            // Texto con la evaluación f(n)
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y + 4);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#f8fafc');
            text.setAttribute('font-size', isPath ? '11' : '9');
            text.setAttribute('font-weight', '700');
            text.textContent = nodeData.f !== undefined ? `f:${nodeData.f}` : '';

            // Tooltip nativo
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `Estado: [${id}]\ng: ${nodeData.g}, h: ${nodeData.h}, f: ${nodeData.f}\nAcción: ${nodeData.action || 'Inicio'}`;
            gNode.appendChild(title);

            // Al hacer clic en un nodo de la ruta, saltar a ese paso
            gNode.addEventListener('click', () => {
                const pathIdx = (solutionData.solution_path_ids || []).indexOf(id);
                if (pathIdx !== -1) {
                    goToStep(pathIdx);
                }
            });

            gNode.appendChild(circle);
            gNode.appendChild(text);
            nodesGroup.appendChild(gNode);
        });

        graphSvgEl.appendChild(nodesGroup);
        highlightActiveGraphNode();
    }

    function highlightActiveGraphNode() {
        if (!solutionData) return;

        // Remover resaltados previos
        const prevActive = graphSvgEl.querySelector('.active-ring');
        if (prevActive) prevActive.remove();

        const currentId = stateToId(currentBoard);
        const nodeGroupId = `graph-node-${currentId.replace(/,/g, '-')}`;
        const targetGroup = document.getElementById(nodeGroupId);

        if (targetGroup) {
            const circle = targetGroup.querySelector('circle');
            if (circle) {
                const cx = circle.getAttribute('cx');
                const cy = circle.getAttribute('cy');

                const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                ring.setAttribute('class', 'active-ring');
                ring.setAttribute('cx', cx);
                ring.setAttribute('cy', cy);
                ring.setAttribute('r', '24');
                ring.setAttribute('fill', 'none');
                ring.setAttribute('stroke', '#f59e0b');
                ring.setAttribute('stroke-width', '3');
                ring.setAttribute('stroke-dasharray', '4,2');

                targetGroup.insertBefore(ring, circle);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Gestión de Pestañas Superiores
    // -------------------------------------------------------------------------
    function initTabs() {
        const tabButtons = [
            { btn: document.getElementById('tab-btn-graph'), tab: document.getElementById('tab-graph') },
            { btn: document.getElementById('tab-btn-stats'), tab: document.getElementById('tab-stats') },
            { btn: document.getElementById('tab-btn-learn'), tab: document.getElementById('tab-learn') },
        ];

        tabButtons.forEach(({ btn, tab }) => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(item => {
                    item.btn.classList.remove('active');
                    item.btn.setAttribute('aria-selected', 'false');
                    item.tab.classList.remove('active');
                });

                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                tab.classList.add('active');
            });
        });
    }

    // -------------------------------------------------------------------------
    // Registro de Eventos de Botones
    // -------------------------------------------------------------------------
    function initEventListeners() {
        btnRandom.addEventListener('click', generateRandomSolvableBoard);
        btnSolve.addEventListener('click', solveCurrentBoard);

        btnReset.addEventListener('click', () => {
            pausePlayback();
            currentBoard = [...initialBoardBackup];
            if (solutionData) {
                goToStep(0);
            } else {
                renderBoard();
            }
            showAlert('Tablero restablecido a su estado inicial.', 'info');
        });

        btnFirst.addEventListener('click', () => goToStep(0));
        btnPrev.addEventListener('click', () => goToStep(currentStep - 1));
        btnPlay.addEventListener('click', togglePlay);
        btnNext.addEventListener('click', () => goToStep(currentStep + 1));
        btnLast.addEventListener('click', () => {
            if (solutionData) goToStep(solutionData.solution_path.length - 1);
        });

        speedSelect.addEventListener('change', () => {
            if (playbackTimer !== null) {
                pausePlayback();
                startPlayback();
            }
        });

        graphNodeLimitEl.addEventListener('change', () => {
            if (solutionData) renderGraph();
        });
    }

    // -------------------------------------------------------------------------
    // Inicialización del Tablero
    // -------------------------------------------------------------------------
    initTabs();
    initEventListeners();
    renderBoard();
    renderEmptyGraph();
    updatePlaybackUI();
});
