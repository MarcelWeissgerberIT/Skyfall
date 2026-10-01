# SKYFALL

**Earth has been cancelled.**

In 1957 Earth started broadcasting television into space. Seventy years later somebody out there
finally binged all of it. The reviews are in: *one star. Too many cooking shows. The cows were the
only good characters.* The network pulled the plug on the whole planet, the cows got a spin-off,
and everybody else gets probed.

You are **Dale** from Pine Bluff, Nevada (pop. 1,204, for now). Divorced. His shotgun was never
loaded. But he knows where the sheriff leaves his keys. Save who you can. Nobody is coming.

An isometric, real-time survival game for mobile browsers - **not a shooter**. Dale is defenceless on
foot; cars are everything. There are no levels: the invasion escalates continuously through threat
levels, day/night cycles, meteor showers (the actual *skyfall*), landed saucers, tractor beams that
grab cars, people and cows, and the occasional meeting with the Network Executive herself.

## Play

Open the GitHub Pages site on your phone (portrait) or desktop. Add it to your home screen for
fullscreen.

| | Touch | Keyboard |
|---|---|---|
| Walk / steer | thumb anywhere (floating joystick) | WASD / arrow keys |
| Get in / out, carjack, talk, pet, search, rig | context button | E / F |
| Honk (in a car) / whistle (on foot) | horn button | Space / H |
| Alien nitro | nitro button | Shift / Q |
| Pause | pause button | Esc / P |

- **Cars:** police cruiser, sheriff's car, pickup truck and minivan, each with its own speed,
  toughness, fuel tank and number of seats. Steal them from panicking drivers if you have to.
- **Taxi service:** roll up slowly next to survivors and they jump in. Drop them at the **evac bus**
  by the sandbag fort. Honking calls survivors over.
- **Honk** at saucers to scare them off - it saves cows, people and your own car from tractor beams.
  It also startles aliens.
- **Run aliens over** (brutes will wreck your car), **ram landed saucers**, rig the gas station.
- **Fuel and damage:** cars burn gas and fall apart. Fuel cans, duct-tape toolboxes, medkits and alien
  nitro are scattered around, in houses (search them on foot) and handed out by grateful survivors.
- **Property damage** is tracked to the dollar: flamingos, mailboxes, hydrants (water fountains!),
  streetlights, palm trees, cars, the gas station. The insurance industry is watching.
- The town is alive: traffic on the roads, crowds fleeing aliens, a very good dog, cows, tumbleweeds,
  vultures, chimney smoke, burning houses.
- **Missions** from a very sarcastic dispatcher: taxi runs, roadkill quotas, demolition, carjacking,
  ramming saucers, honking cows free, blowing up the gas station.

## How it's built

- Plain HTML5 canvas + ES modules, no build step, no external libraries, fonts or icons.
- Every image (sprites, buildings, textures, UI, icons, the bitmap font, the title screen) and the
  intro cutscene clips were generated with Higgsfield (GPT Image 2.5, Nano Banana Pro, Kling 3.0)
  from scratch for this game, using hand-painted tilt-shift miniature dioramas as the art direction.
- All sound effects and the theremin soundtrack are synthesised live with WebAudio.
- Real-time isometric renderer with projected cast shadows, day/night lighting, a flashlight,
  colour grading that gets more apocalyptic over time, and a tilt-shift post effect.

`tools/process_assets.py` turns the raw generations into game assets (trimming, scaling, WebP,
seamless textures, slicing the glyph sheets into the font atlas). `tools/make_icons.py` builds the
app icons.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
