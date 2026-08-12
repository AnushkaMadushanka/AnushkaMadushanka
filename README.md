## Anushka Madushanka

Full-stack engineer, shipping production code since 2017 — the last five years
remote with Australian teams.
Currently building Uplist, Ray White's pre-market real-estate app, as a
mobile-focused full-stack engineer in a small cross-functional product team;
it's in pilot with 93 agents across 10 offices. Before that, nearly four years
as lead developer at ShopShare.tv. Based in Colombo; open to remote roles and
on-site.

Most of those years are production code I can't link to, so the commercial work
is written up properly on my portfolio. What's public here is side projects and
tools.

**Start here**

- [Case studies](https://anushkamadushanka.github.io/#work) — Uplist, ShopShare, ShopRecorder and Shopcast, each written up end to end
- [mocap-hpe](https://github.com/AnushkaMadushanka/mocap-hpe) — markerless motion capture: a Keras pose-lifting ensemble behind a Node, Postgres and S3 job pipeline
- [auto-extension-reloader](https://www.npmjs.com/package/auto-extension-reloader) — a webpack plugin I published to npm
- [itch.io](https://anushka-madushanka.itch.io/) — Unity games, two playable in the browser

[Portfolio](https://anushkamadushanka.github.io) · [LinkedIn](https://www.linkedin.com/in/anushka-madushanka/) · [anushkamadushanka1998@gmail.com](mailto:anushkamadushanka1998@gmail.com)

---

### Side experiment: pass the torch

<!-- torch:start -->

<a href="https://torch.anushkamadushanka1998.workers.dev/claim"><img alt="World map of the torch's route, currently in Maharagama, Sri Lanka" src="https://raw.githubusercontent.com/AnushkaMadushanka/AnushkaMadushanka/main/assets/map-0001.svg" width="100%"></a>

<a href="https://torch.anushkamadushanka1998.workers.dev/claim"><img alt="Take the torch to my city" src="https://raw.githubusercontent.com/AnushkaMadushanka/AnushkaMadushanka/main/assets/take-the-torch.svg" width="100%"></a>

<p align="center"><sub>Pressing it runs a Cloudflare Worker that geolocates you, redraws this map and commits it to this repo — about a second, no CI.</sub></p>

<details>
<summary>Additional information</summary>

**How it works**

One person holds the torch at a time. Press the button and Cloudflare's edge
network resolves your approximate city from the request itself — no form, no
sign-in, nothing to type. A Worker measures the great-circle distance from the
last holder to you, redraws the map, commits it straight to this repository and
sends you back here, all in a second or two.

There is no CI, no database and no build step: the Worker is the whole
application, about 150 lines of it, and the map above was drawn by whoever
clicked before you. Source is in [`worker/`](worker/).

**Where it has been**

- Colombo, Sri Lanka — 0 km

<sub>City from Cloudflare's edge, rounded to ~1 km. Nothing else recorded.</sub>

</details>

<!-- torch:end -->
