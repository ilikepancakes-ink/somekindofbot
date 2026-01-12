# Hello!/Hallo!
(this document is in Dutch and English!)
(Dit document is in het Nederlands en Engels!)
-
## somekindofbot
a random project that i made one day because i got bored T-T

### Features
- App dashboard for manageing your self-deployed bot without needing to use the discord client
- Made in typescript (this is a feature because python sucks)
- uhhh security stuff idk lmao
- easy to build and deploy
---
### How to deploy the bot
1. clone the repo 
```bash
git clone https://github.com/ilikepancakes-ink/somekindofbot.git
```
2. install all needed packages
```bash
# ubuntu/debian
sudo apt-get install npm nodejs
# macOS
brew install nodejs
# Arch/Endevor/Blackarch/whatever the fuck uses arch
sudo pacman -Syu
sudo pacman -S npm nodejs
# fuck you windows/every other distro im not writting instructions
```
3. cd into the repo
```bash
cd somekindofbot
```
3. set your ENV variables 
```bash
cd bot
mv .env.example .env
nano .env
```
go to the discord developer portal and create a discord bot and get your discord token (the rest is optional) and paste in your token into the DISCORD_TOKEN= variable and then hit CTRL/CMD + X

4. exit the bot folder
```bash
cd ..
```
5. build and deploy
```bash
npm build
npm run deploy
```
Congrats you have now deployed the main bot!



## Dutch/Nederlands
Een willekeurig project dat ik één dag geleden heb gemaakt, omdat ik een beetje moe was T-T

### Functies
- App dashboard voor het beheren van je zelf-geïnsteerde bot zonder het Discord-client te hoeven gebruiken.
- Gemaakt in TypeScript (dit is een functie omdat Python rotst)
- Uhhh - security dingen ik niet begrijpelijk vind lmao
- Eenvoudig op te bouwen en te deployen.

### Hoe te deployen
1. Clone het repo:
```bash
git clone https://github.com/ilikepancakes-ink/soortbot.git
```

2. Installeer alle benodigde pakketten:
```bash
# Ubuntu/Debian
sudo apt-get install npm nodejs
# macOS
brew install nodejs
# Arch/Endevor/Blackarch/whatever the fuck uses arch
sudo pacman -Syu
sudo pacman -S npm nodejs
# Fuck you windows/every other distro I'm not writing instructions
```

3. Ga naar de repot:
```bash
cd somekindofbot
```

4. Stel je omgevingsvariabelen in:
```bash
cd bot
mv .env.example .env
nano .env
```

5. Ga naar de Discord developer portal en maak een Discord bot en krijg je Discord token (het rest is optioneel). Vul de DISCORD_TOKEN= in de variabel in en druk op CTRL/CMD + X.

6. Verlaat de bot folder:
```bash
cd ..
```

7. Bouw en deploy:
```bash
npm build
npm run deploy
```

Congrats, je hebt nu de belangrijkste bot geautomatiseerd!
