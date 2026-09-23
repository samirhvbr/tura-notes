# SVG em data: com um tab no esquema

O filtro antigo testava o prefixo literal `data:` e deixava passar o que não
começasse exatamente assim; o sanitizador resolve o esquema removendo o tab e
aceitava `data`. Os dois discordavam, e o permissivo vencia: um SVG — que é
documento com script, não imagem — atravessava a lista de raster.

<img src="da&#9;ta:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+" alt="x">

O resto da nota continua.
