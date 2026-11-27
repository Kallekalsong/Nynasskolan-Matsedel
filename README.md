# Nynässkolans matsedel

En responsiv svensk matsedelssida för Nynässkolan i Gävle. Menyn hämtas från skolans RSS-flöde med GitHub Actions och publiceras kostnadsfritt med GitHub Pages.

**Öppna den publicerade sidan:** [Nynässkolans matsedel på GitHub Pages](https://kallekalsong.github.io/Nynasskolan-Matsedel/).

## Så fungerar uppdateringen

Workflowen `Uppdatera matsedel` hämtar RSS-flödet serverbaserat varje timme, validerar skolnamnet, delar upp måltiderna och sparar `data/menu.json`. Webbläsaren hämtar aldrig RSS direkt. Om källan inte kan läsas skapas ingen påhittad meny; JSON-filen får felstatus och sidan visar ett begripligt fel. Workflowen kan även startas manuellt under fliken **Actions**.

GitHub Actions kör schemalagda jobb i UTC och kan ibland starta några minuter efter den angivna tiden. Ingen API-nyckel eller hemlighet behövs.

## Publicera med GitHub Pages

1. Lägg filerna i ett GitHub-repo på standardgrenen `main`.
2. Öppna **Settings → Pages** och välj **GitHub Actions** som byggkälla om Pages inte redan aktiverats.
3. Under **Actions**, kontrollera att **Publicera GitHub Pages** lyckades. Adressen visas i miljön `github-pages`; för ett vanligt repo är den `https://<ägare>.github.io/<repo>/`.
4. Kör **Uppdatera matsedel** manuellt en gång för att fylla första menyn. Uppdateringsworkflowen kör därefter varje timme.

## Lägg till i en vanlig Microsoft Teams-gruppchatt

1. Öppna gruppchatten och välj **+** / **Lägg till en flik**.
2. Välj **Webbplats**. Om appen saknas i listan kan den vara blockerad av organisationens Teams-policy.
3. Ange fliknamnet **Matsedel** och klistra in GitHub Pages-adressen.
4. Spara fliken. Microsofts Teams-hjälp beskriver flikar i gruppchattar; enskilda organisationer kan ändå begränsa vilka flikar som får läggas till. Om sidan inte renderas i Teams, använd **Öppna i webbläsare**.

GitHub Pages-adressen är offentlig. Lägg inte in personuppgifter eller hemligheter i repot. Sidan länkar direkt till det publika RSS-flödet som källa.

## Väder, busstider och läsår

Väderkortet visar nu även daglig sannolikhet för nederbörd. Dagens lunch får en tydligare markering. Knappen **Skriv ut / PDF** öppnar webbläsarens utskriftsdialog; välj **Spara som PDF** där. Kalenderkortet visar Gävle kommuns publicerade lov och studiedagar för läsåret 2026/2027. Lokala studiedagar 7–8 januari är för Nynässkolan. Kontrollera kommunens sida för uppdateringar och lokala ändringar. Uppdatera datumen i `index.html` när ett nytt läsår publiceras.

## Väder och busstider

Väderdelen visar aktuellt väder och femdagarsprognos för Nynässkolan (60.67800, 17.13183). Den hämtar data direkt från Open-Meteos publika Forecast API utan API-nyckel och uppdateras varje timme medan sidan är öppen. Om vädertjänsten inte svarar visas ett tydligt felmeddelande. Busstiderna visas som veckoschemat som anges direkt i `index.html`; ändra tiderna där om schemat ändras.

## Logotyp

Den egna vektorlogotypen ligger i `assets/nynas-logo.svg`. Den används i sidhuvudet, sidfoten och som favicon. Ändra SVG-filen där om du vill byta färger eller symbol.

## Ändra och underhålla

- Ändra RSS-adressen i `scripts/fetch_menu.py` om källan ändras.
- Ändra utseende i `styles.css` och texter/layout i `index.html`.
- Ändra klientlogik i `app.js`.
- Följ körningarna under **Actions**. Fel visas även direkt på sidan via `data/menu.json`.

## Datakälla

[Skolmaten RSS för Nynässkolan](https://skolmaten.se/api/4/rss/week/nynasskolan?locale=sv)
