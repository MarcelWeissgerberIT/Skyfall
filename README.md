# SKYFALL

**Earth has been cancelled.**

In 1957 Earth started broadcasting television into space. Seventy years later somebody out there
finally binged all of it. The reviews are in: *one star. Too many cooking shows. The cows were the
only good characters.* The network pulled the plug on the whole planet, the cows got a spin-off,
and everybody else gets probed.

You are **Dale** from Pine Bluff, Nevada (pop. 1,204, for now). Divorced. Owns a shotgun.
Had no plans for Tuesday. Survive as long as you can. Nobody is coming.

An isometric, real-time survival game for mobile browsers. There are no levels: the invasion
escalates continuously through threat levels, day/night cycles, meteor showers (the actual
*skyfall*), landed saucer nests, cow abductions and the occasional visit from the Network
Executive herself.

## Play

Open the GitHub Pages site on your phone (portrait) or desktop. Add it to your home screen for
fullscreen.

| | Touch | Keyboard |
|---|---|---|
| Move | left thumb (floating joystick) | WASD / arrow keys |
| Aim & fire | automatic (drag on the right half to aim manually) | automatic |
| Grenade | grenade button | Space / G |
| Pause | pause button | Esc / P |

Pickups: shells, medkits, grenades, SMG, alien plasma core. Civilians hand you supplies if you get
close before the aliens do. Shoot the landed saucers before they fill the town.

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
