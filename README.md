# Nynässkolans matsedel

En responsiv svensk matsedelssida för Nynässkolan i Gävle. Menyn hämtas från skolans RSS-flöde med GitHub Actions och publiceras kostnadsfritt med GitHub Pages.

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

## Ändra och underhålla

- Ändra RSS-adressen i `scripts/fetch_menu.py` om källan ändras.
- Ändra utseende i `styles.css` och texter/layout i `index.html`.
- Ändra klientlogik i `app.js`.
- Följ körningarna under **Actions**. Fel visas även direkt på sidan via `data/menu.json`.

## Skolkalender

Kalendern finns på `https://kallekalsong.github.io/Nynasskolan-Matsedel/kalender/` och kan läggas till som en egen Teams-flik. Den använder `kalender/events.json`; lägg in verkliga datum där när de är klara att publicera. Varje händelse kan ha `date` (`ÅÅÅÅ-MM-DD`), `title`, `category` (`aktivitet` eller `prov`), `time`, `location`, `description` och `url`. Lämna listan tom tills ni har bekräftade datum. Sidan uppdaterar kalenderfilen var 15:e minut och erbjuder nedladdning som `.ics` när det finns händelser.

## Datakälla

[Skolmaten RSS för Nynässkolan](https://skolmaten.se/api/4/rss/week/nynasskolan?locale=sv)
