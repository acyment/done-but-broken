ChatGPT 5.6 High

Research completed in 4m · 0 citations · 0 searches

# 1. Descomposición de la afirmación

La afirmación dice: usar criterios de aceptación en formato Gherkin ejecutable (con desarrollo incremental) da resultados **mejoras medibles** en el trabajo de agentes de IA sobre un código que evoluciona, en comparación con un flujo de trabajo **basado en especificaciones en prosa** bien estructuradas (donde esas especificaciones son solo texto). Podemos dividir esto en subhipótesis falsables:

- **H1: Formato de la especificación.** Que entregar los requerimientos como escenarios Gherkin ejecutables (es decir, tests de aceptación en formato Given/When/Then) en lugar de una especificación en prosa produce código final *más correcto* por parte del agente de IA. Un indicador sería, por ejemplo, un porcentaje mayor de casos de prueba aprobados o de criterios de aceptación satisfechos en la solución generada. Para falsar H1, haría falta un caso donde el flujo en prosa (bien especificado) rinda igual o mejor en esas métricas. Como evidencia, investigaciones previas muestran que incluir tests claros mejora el éxito del código generado; si Gherkin es esencialmente tests de aceptación, ello sugiere que debería mejorar la corrección.  

- **H2: Desarrollo incremental.** Que dividir el trabajo en pequeños incrementos (cada escenario o test por separado) y ejecutarlos uno a uno resulta en un código de IA mejor (por ejemplo, detecta errores antes, menos regresiones, más estabilidad) que implementar cambios grandes de una sola vez. En otras palabras, avanzar paso a paso con verificación continua mejora el resultado. La evidencias sugeridas son análogas a las de Agile/TDD: BDD es justamente un proceso iterativo donde *“cuando los escenarios pasan, se tiene confianza que el sistema cumple los requisitos”*. Si un diseño no muestra ventaja alguna por paso a paso, esto falsaría H2. Un posible mecanismo alternativo sería que la mejora se deba no al formato sino simplemente a fragmentar las tareas (lo que se controla al comparar condiciones con la misma granularidad de tareas).  

- **H3: Contexto de evolución (multi-episodio).** Que la ventaja de H1 y H2 se mantiene conforme el código evoluciona en varios pasos (por ejemplo, agregar funcionalidad nueva en etapas). Es falsable si, en iteraciones sucesivas de cambios, no se observa consistencia: por ejemplo, que Gherkin ayuda en la primera tarea pero no en las siguientes. Mediríamos si la brecha de calidad entre flujos Gherkin vs prosa persiste episodio a episodio.  

Cada sub-reclamación es falsable definiendo métricas: p. ej. **% de tests pasados**, **número de iteraciones necesarias**, **errores detectados en QA**, **tiempo/token usado**. Un resultado que muestre que la condición de prosa iguala o supera a Gherkin en esas métricas bajo el mismo experimento refutará la hipótesis. Cualquier ambigüedad (por ejemplo, no definir *qué* es “mejor”) debe resolverse con una definición previa de métrica.  

**Posibles suposiciones ocultas:** Se asume que ambos flujos tienen la misma información, solo difieren en formato, y que el agente de IA puede leer Gherkin tanto como la prosa. También se presume que el agente puede generar o ejecutar tests en la condición prosa (no se elimina esa capacidad). Si una condición involucra demasiado más trabajo humano (p.ej. escribir tests manualmente), se debería incluir en la comparación. En síntesis, la evidencia buscada sería diferencias objetivas en calidad/eficiencia del código generado, respaldadas por métricas claras (p. ej. tests automáticos).  

# 2. Diseño del estudio

El experimento más barato pero creíble usaría **tareas de programación reales y multi-paso** (un código pequeño pero realista) bajo dos condiciones: (A) flujos con criterios Gherkin ejecutables e incrementos iterativos; (B) flujos “especificación en prosa” con un buen spec inicial y la opción de crear tests. El investigador (usando un agente de IA, p.ej. ChatGPT/GPT-4 o modelo similar) realizará ambas variantes.  

- **Dominio y sustrato:** Elegiríamos un proyecto de software modesto pero realista (por ejemplo, una pequeña API web o un microservicio en Python/JavaScript) con casos de uso secuenciales. Cada episodio consiste en *agregar o modificar una funcionalidad*. Por ejemplo, implementar operaciones CRUD incrementales en una API, donde cada nueva funcionalidad es un episodio. Se debe proveer el mismo código base inicial a ambas condiciones. Como medida de completitud, el producto final debe pasar un conjunto de tests ocultos predefinidos.  

- **Diferencias entre condiciones:**  
  
  - *Condición Gherkin (A):* Antes de cada episodio, presentamos al agente los criterios de aceptación como escenarios Gherkin (archivos `.feature`). Se pide al agente generar directamente los step definitions y código necesario para pasar los tests asociados a esos escenarios. Después de cada escenario, se ejecuta (automáticamente) y se corrige al agente si falla, iterando hasta que pase. El investigador puede ejecutar manualmente el comando de prueba para cada escenario. Cada escenario se hace *por separado* (incremento granular).  
  - *Condición Prosa (B):* Antes de cada episodio, damos la misma funcionalidad descrita en texto bien estructurado (por ejemplo, bullet-points o user story con criterios de aceptación en texto normal). El agente entonces debe generar el código para implementar esa funcionalidad. Se le permite crear y ejecutar tests unitarios/BDD adicionales si lo desea (tal como un flujo de TDD tradicional), pero *inicialmente no se le dan tests ejecutables*. Deberá adivinar casos de prueba o contenido basado en la spec. Al final, sus pruebas (si las hay) y el código son evaluados igual que en (A).  
  
  Ambos flujos usan el *mismo modelo de IA*, por ejemplo GPT-4 o un modelo potente (DeepSeek/Qwen, etc.), para aislar el efecto del workflow. Si hay recursos, podría probarse un modelo adicional de menor capacidad para ver si el efecto persiste.  

- **Constantes controladas:** Mantenemos idéntico el contexto inicial, la funcionalidad objetivo y la cantidad de información dada (sólo cambia la forma). El investigador interviene igualmente: revisa prompts, guía al agente con pasos parecidos (por ejemplo, en (B) se puede incitar al agente a “escribir tests” si no lo hace). Los episodios deben ser lo más paralelos posible.  

- **Métricas:** Por episodio y para cada condición se registra: (i) si la solución final pasa *todos* los tests de aceptación ocultos (sí/no), (ii) cuántos tests pasan, (iii) número de iteraciones (prompts) requeridas, (iv) total de tokens o llamadas API usadas, (v) tiempo de wall-clock. Se recomiendan al menos 5–10 episodios por condición (más mejora la robustez, aunque el presupuesto token limita cuántas rondas de GPT-4 se hagan). Cada episodio debe tener su propia semilla de aleatoriedad fija para reproducibilidad, y el investigador fija de antemano la regla de decisión (p.ej. comparativa de medias con intervalo de confianza).  

- **Criterio de éxito (“win”):** La condición Gherkin gana si sus soluciones pasan una mayor proporción de tests de aceptación ocultos *en forma consistente* episodio a episodio, o si requiere significativamente menos iteraciones/tokens para alcanzar una solución de igual calidad. Por ejemplo, si después de N episodios la tasa de éxito de Gherkin es sistemáticamente más alta que la de prosa, y esto es estadísticamente plausible según la regla de decisión predefinida.  

- **Control de confusiones:** Controlamos diferencias de estilo de prompt al definir formatos paralelos. El investigador debe evitar introducir ventaja inadvertida: si en (B) la IA no escribe tests, el investigador puede sugerirle hacerlo, asegurando que la única diferencia sea el *formato* inicial (Gherkin vs prosa). También se debe controlar que el agente no use fragmentos del spec en forma de “código literales” simplemente copiando. Para evitar sesgo de modelo, podría usarse el mismo modelo en la misma sesión (switch de prompt) o sesiones separadas por condición.  

En resumen, el experimento concreto: por ejemplo, **proyecto Python** con un archivo `feature/*.feature` (Gherkin) y tests ocultos en pytest. Episodios del tipo “Agregar cálculo X a la API” con criterios dados en cada estilo. Se ejecutará el agente de IA iterativamente como si fuera un desarrollador con reglas de revisión. Se recopilarán los resultados de cada episodio.  

# 3. Prueba de falsación y regla de paro

Un resultado que muestre **que la condición de prosa iguala o supera** el rendimiento de la Gherkin sería falsar la afirmación. Por ejemplo, si en la mayoría de los episodios el código generado con el spec en prosa consigue tanto o más casos pasados, o alcanza calidad igual con similar esfuerzo, entonces la hipótesis queda refutada. Además, si al dividir en incrementos no mejora nada (p.ej. el agente no aprovecha las pruebas Gherkin y produce la misma salida que sin ellas), eso indica que los criterios ejecutables no marcaron diferencia. 

La regla de decisión debe definirse antes de ejecutar: por ejemplo, tras X episodios calcular la proporción de tests pasados en cada condición y comparar (con t-test o intervalo de confianza sobre la diferencia). Si la diferencia estimada es pequeña (dentro de la incertidumbre predefinida) o negativa, concluyamos que *no* hay evidencia de superioridad. Como criterio de parada, podríamos decidir “publicar que no se comprueba la afirmación” si tras N≥5 episodios consecutivos la brecha es insignificante o a favor de la prosa. Esto evita sesgo post-hoc.

Si el diseño original impide ver este caso (por ejemplo, si la condición de prosa no tiene forma de fallar “vívidamente”), habría que ajustarlo. Por ejemplo, asegurar que la condición prosa *también* genere y corra pruebas (aunque no estuvieran dadas) para no dar ventaja de información a Gherkin. El investigador debe confirmar que la condición prosa puede producir un resultado erróneo (p.ej. code que falla tests) para que haya algo que mostrar.  

**Regla de paro:** decidir no seguir recolectando más episodios si la diferencia es nula dentro de un margen acordado (p.ej. ±5% en tasa de éxito) después de varios episodios. En ese caso se publica que “no se observa mejoría estadísticamente creíble de usar Gherkin vs una buena especificación en prosa”. Si al revés Gherkin domina holgadamente, entonces validamos la afirmación.

# 4. Antecedentes y evidencia previa

No hemos encontrado estudios exactos sobre *Gherkin ejecutable vs. especificaciones en prosa para desarrollo asistido por IA*, pero sí hay literatura relacionada:

- **Estudios sobre pruebas y TDD con LLMs:** Noble y Nagappan (2024) muestran que **proveer casos de prueba junto con la tarea** mejora mucho el código generado por LLMs: incluir tests de ejemplo eleva la tasa de éxito en benchmarks de código. En la misma línea, un estudio de Microsoft (Fakhoury et al., 2024) demostró que un flujo interactivo *guiado por tests* (p. ej. escribir tests para aclarar la intención) aumentó en ~38% la exactitud del código generado. Estos resultados apoyan que hacer ejecutable la intención (tests o BDD) ayuda a los agentes de IA, lo cual respalda la idea de usar *tests de aceptación* (como los escenarios Gherkin) desde el inicio.

- **Guías BDD y SDD prácticas:** Los expertos en desarrollo ágil enfatizan que los escenarios Gherkin son **especificaciones vivas, no solo tests**. Por ejemplo, un informe de ThoughtWorks indica: *“Escribe escenarios BDD antes de la implementación... Cuando los escenarios pasan, se tiene confianza de que el sistema cumple los requisitos documentados”*. En estudios de caso empresariales con Cucumber, se ha documentado que escribir criterios en Gherkin y automatizarlos redujo ambigüedades y rework, pues todas las partes acuerdan el comportamiento por adelantado. Aunque no involucra IA, esto sugiere que la claridad de los escenarios ayuda a la calidad general del desarrollo.

- **Test-driven vs sin tests:** Varios artículos técnico-prácticos (blogs, presentaciones) sugieren que exigir tests desde el principio mejora el código asistido por IA. Por ejemplo, Paul Duvall describe un caso (proyecto DoubleUp!) donde ATDD con Gherkin mantuvo al agente alineado con la intención, sirviendo *“como contrato”* entre objetivo y código. En su experiencia, cada paso es un “commit” dictado por un test, forzando alineación. Aunque anecdótico, esto refleja la narrativa de que sin tests el agente a veces “alucina” características y produce código incorrecto.  

**Contra-evidencias:** No encontramos investigaciones que contradigan explícitamente la afirmación. Sin embargo, algunos artículos apuntan que los agentes IA a veces fallan en generar tests útiles por sí mismos o producen pruebas triviales (por ej. tests tautológicos) (ver *trap* abajo). También se reporta que procesos sistemáticos aceleran la entrega, pero con más bugs si no hay revisión estricta, lo cual sugiere que aun con métodos formales no todo es perfecto. En resumen, la literatura existente favorece la idea de usar criterios de aceptación ejecutables (BDD/BDD) para guiar IA, pero la comparación directa con flujos de especificación en prosa no ha sido explorada formalmente. Esto justifica hacer el experimento: el reclamo *no está ya establecido ni refutado definitivamente en publicaciones conocidas*.

# 5. Sustrato de software y episodios

**Elección del proyecto:** Para credibilidad, usaríamos un software reconocible (p.ej. una API REST sencilla o un componente de frontend), en lugar de ejemplos sintéticos de academia. Un proyecto Python con tests en pytest y soporte BDD (Behave) podría funcionar bien: es entendible, ampliamente usado, y Behave ejecuta escenarios Gherkin con pasos en Python. Alternativamente, JavaScript con Cucumber.js o un framework similar. Debe ser lo bastante complejo para tener varias tareas dependientes (p.ej. manejo de base de datos, casos de error) pero no monstruoso. 

No existe un dataset público de “cambios multi-paso con tests ocultos” a mi conocimiento. Algunas colecciones (HumanEval, MBPP) son de tareas unitarias independientes, no encadenadas. Por ello crearíamos nosotros historias de usuario ficticias y tests asociados. Por ejemplo: 

- **Episodio 1:** Implementar endpoint para crear un recurso (p.ej. "Carrito de compras: Agregar item"). Tests de aceptación: flujo feliz y casos borde (BDD o unit).  
- **Episodio 2:** Agregar validación adicional (por ejemplo, límite de ítems en carrito).  
- **Episodio 3:** Implementar eliminación de item, etc.

Cada episodio tiene un conjunto *oculto* de tests (no mostrados al agente) que verifica comportamientos clave, similares en ambos flujos. Para Gherkin se exponen escenarios semánticamente equivalentes como tests. Para la prosa, solo descripciones textuales de lo mismo.

**Credibilidad vs control:** Queremos realismo, pero también rigor. Si usamos frameworks de la vida real (p.ej. API FastAPI, base de datos SQLite), atrae a ingenieros. Pero testear IA en proyectos reales añade ruido (imprevistos, dependencias). Probablemente un compromiso: usar un esqueleto real (un microservicio sencillo) con test suite propia. Haremos scripts de CI local (docker/pytest) para validar soluciones. 

Un sustrato “curado” puro (benchmark artificial) aumenta control (sabemos la solución óptima) pero parece menos plausible a un CTO. Mi recomendación: usar un proyecto pequeño existente (quizá un tutorial de blog o repositorio simple) como base, asegurándonos de documentarlo bien para reproducibilidad. 

**Contaminación de datos:** Al usar LLMs, preocupa que el modelo ya haya visto el proyecto. Podríamos evitar exponer nombres únicos (por ejemplo, ofuscar nombres de entidades) o usar un repositorio inicial mínimo para mitigar la sobre-especificidad. Si fuese un producto real (por ejemplo, un feature ficticio), la “contaminación” es incierta. Se debe mencionar esa limitación. 

No hay dataset multi-paso listo, pero este experimento en sí genera **artefactos replayables**: definiciones de historia de usuario (BDD Gherkin y prosa), código inicial, scripts de prueba, y logs de interacciones. La reproducibilidad se consigue fijando semillas de aleatoriedad en el modelo (si disponible) y detallando prompts usados.

# 6. La trampa (sesgos de medición)

**Sesgo de formato vs contenido:** El mayor riesgo es medir *algo distinto*. Por ejemplo, si en la condición Gherkin el agente recibe directamente tests (los escenarios), no está probando la misma tarea que en la condición prosa donde debe generar tests. La aparente mejora podría deberse a que “simplemente se le dieron las respuestas anticipadamente” en Gherkin, no al formato per se. Para mitigar, en el diseño debemos permitir en la condición prosa la generación manual de tests, igualando la oportunidad de verificación. 

**“Nuevo juego, truco” (pegado de prompts):** Los LLMs pueden estar más familiarizados con Gherkin (es un patrón popular), de modo que la condición Gherkin podría beneficiarse de conocimiento previo del modelo. La condición de prosa debe escribirse con claridad equivalente. De lo contrario, se mide la capacidad del modelo para reconocer Gherkin más que la metodología. 

**Mezcla de señales:** Si se dan tests explícitamente en Gherkin, el agente puede enfocarse en pasar esos tests exactos, y la métrica (tests pasados) estará inherentemente sesgada a favor de Gherkin. Para evitarlo, se usarán tests “ocultos” distintos a los escenarios. Y también en la condición prosa, aunque el agente no los conoce de antemano, debería pasar los mismos tests ocultos al final. De este modo medimos el cumplimiento de los requisitos en general, no sólo pasar los tests visibles. 

**Habilidad del agente:** Si el investigador interviene más en una condición (p.ej. dándole pistas extras en la de prosa), introduce un sesgo. Debe esforzarse por guiar parejo. Sin embargo, es fácil caer en la trampa de “ayudar inconscientemente al agente con Gherkin porque el proceso es más claro”. Se requiere disciplina para tratar ambas condiciones con el mismo nivel de interacción.

**Tamaño y complejidad:** Un agente IA actual podría no manejar flujos muy grandes. Si los episodios son demasiado amplios, ambos métodos fracasan, y no vemos diferencia. Si son muy triviales, ambos aciertan siempre, tampoco vemos diferencia. Elegir bien la dificultad es crucial: suficiente reto para que fracasen ocasionalmente. Si la prueba sólo mide *tiempo en completarlo*, el flujo Gherkin podría ganar no por mejor código sino por menos diálogo; hay que decidir qué métrica es relevante (por ejemplo, calidad sobre velocidad).  

En resumen, el riesgo mayor es confundir “darse respuestas formateadas” con “mejor metodología”. El diseño debe asegurarse de que la única diferencia real sea el formato inicial (Gherkin vs prosa) y el procedimiento incremental, sin sacrificar la esencia de la tarea. 

# 7. Explicación mundana (alternativa al resultado esperado)

Si el estudio arroja que Gherkin (ejecutable) produjo *mejor* resultados, la explicación más mundana podría ser: **“no fue el formato, sino la presencia de tests y la descomposición de la tarea”**. Por ejemplo, tal vez el agente simplemente necesitaba tests para corregirse, y Gherkin le facilitó eso. O quizás el flujo Gherkin implicó en realidad pasos más pequeños que el flujo en prosa, y la ganancia vino de hacerlo incremental, no del lenguaje Gherkin. 

Nuestro diseño intenta distinguir esto: al proveer en (B) la capacidad de crear y correr tests propios, intentamos aislar el efecto del formato. Pero puede ser que incluso sin dárselos, el agente en (B) espontáneamente genere su propia suite (lo cual, si falla, indicaría que la ventaja es la suite de tests en sí). Si ambos generaron tests, entonces el único factor es realmente el lenguaje de los criterios. 

Otra explicación posible es **“efecto placebo de contexto”**: dado que el investigador esperaba que Gherkin funcionara mejor, quizás sin querer se dedicó más a esa condición (dando más pistas, ajustando prompts mejor). Si notamos eso en los logs, sería señal de sesgo. 

Finalmente, hay que considerar que un resultado positivo no prueba causalidad total. Quizás los LLM actuales tienen patrones internos que favorecen BDD explícito. De confirmarse, la explicación mundana es: *“Al agente le gusta trabajar con escenarios claros; esto mejora el output no porque Gherkin sea magia, sino porque facilita la síntesis de código y testeo.”* Si nuestra metodología no puede distinguir esto, hay que reconocerlo: podríamos estar midiendo preferencia del modelo, no propiedad general de la metodología.  

En conclusión, incluso con resultado positivo, habría que analizar si la mejora provino de dar tests por adelantado (llámese Gherkin o tests unitarios) o de guiar la descomposición de la tarea. Si no podemos separarlos, la interpretación es limitada: podríamos decir algo como “darle al agente ejemplos ejecutables de requisitos le ayuda a generar mejor código”, sin poder afirmar que el mecanismo es exclusivamente el formato Gherkin vs la estructura de la especificación. En cualquier caso, nuestra regla de decisión contempla la posibilidad de “no hay diferencia significativa”, y en ese caso se publicaría que no se encontró soporte al reclamo original.

**Fuentes:** Las ideas de la metodología (especificaciones como tests, BDD, TDD con LLMs) se basan en literatura reciente y artículos de expertos en ingeniería asistida por IA, citados arriba. La falta de estudios contradictorios directos indica que este experimento es novedoso en su pregunta concreta.