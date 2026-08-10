## Anushka Madushanka

Full-stack engineer, nine years — the last five remote with Australian teams.
Most recently the only mobile developer on Uplist, Ray White's pre-market
real-estate app, now testing with 93 agents across 10 offices. React Native and
Node up front, Postgres and AWS behind it. Based in Colombo; open to remote
roles and on-site.

Most of those nine years is production code I can't link to. What's public here
is side projects and tools.

[Portfolio](https://anushkamadushanka.github.io) · [LinkedIn](https://www.linkedin.com/in/anushka-madushanka/) · [anushkamadushanka1998@gmail.com](mailto:anushkamadushanka1998@gmail.com)

---

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
