# Mars · Teraformace

Česká neoficiální fanouškovská adaptace hry Jacoba Fryxelia pro 1–5 hráčů. Obsahuje mapu Tharsis, 208 projektů základní krabice a Éry korporací, korporace a volitelné moduly Předehra, Venuše, Kolonie a Neklid. UI a obrázky vznikly pro tuto verzi. České názvy karet jsou vlastní překlady.

## Hraní

Na úvodní obrazovce vyber **Založit stůl**, zadej jméno a pošli pozvánku ostatním. Ve dvou až pěti hráčích může hostitel partii zahájit. **Sólová mise** funguje bez vzdáleného protihráče. Během hry můžeš otevřít detail každé karty, vybrat zdroje k platbě, umístit destičku na zvýrazněné pole a sledovat stav korporací a deník.

Hostitel udržuje autoritativní stav, ověřuje tahy a každému posílá pouze příslušný herní pohled. Stůl využívá přímé připojení WebRTC a signalizační službu PeerJS Cloud. Hostitel nechává otevřenou záložku. Jméno, přístup ke stolu a partie hostitele se ukládají v daném prohlížeči. Po obnovení či přerušení připojení lze pokračovat od poslední přijaté volby. Některé podnikové nebo školní sítě přímá spojení omezují.

## Spuštění a sestavení

Potřebuješ Node.js 20+ a nástroj esbuild 0.25.12. `npm install` nainstaluje nástroje. `npm run build` vytvoří `dist/` pro statický HTTPS hosting. Lokální kopii hry lze spustit také otevřením `dist/index.html`. K ověření použij `npm test`. Sestavení lze provést i s existujícím esbuild přes `ESBUILD_BINARY_PATH`.

Netlify čte nastavení z `netlify.toml`. Při propojení s větví `main` spustí `npm run build` a zveřejní obsah složky `dist/`. Pozvánka ke stolu se otevírá přímo na adrese hry.

## Zdroje a licence

Web a upravené herní jádro vydáváme pod GPLv3. Úplný zdroj použitého jádra včetně české integrace pravidel, reprodukovatelného sestavení, helperů a licence je přiložený v `public/vendor/mars-rules-source.zip`. Podklady k herním efektům vycházejí také z projektů Open Mars a Evylon (MIT). Přiložená oznámení k licencím, PeerJS a písmům najdeš v `public/vendor`. Původní deskovou hru vytvořili Jacob Fryxelius a FryxGames.

- [Terraforming Mars Open-source, použitá verze](https://github.com/terraforming-mars/terraforming-mars/tree/680d9fcb861f183eae201f800a26a5836ba03ac2)
- [Open Mars, podklady ke kartám](https://github.com/openmars-app/openmars/tree/7acfc8020893509265f2c09fdd123a099eafdb15)
- [Evylon, srovnávací seznam karet](https://github.com/Evylon/terraforming-mars/tree/119325e22cbe1a29fe1d5b1b6373fa9886bd56a9)
- [Galerie předlohy](https://ssimeonoff.github.io/cards-list)
- [Podklad k mapě NASA/JPL/USGS, Viking a MOLA](https://github.com/karthiksreenivasanp/martian-map/blob/main/DATA_SOURCES.md)
