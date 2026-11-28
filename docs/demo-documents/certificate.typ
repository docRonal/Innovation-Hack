// Demo calibration certificate. Layout only: all values come from the JSON passed via --input.
#let data = json(bytes(sys.inputs.data))

#let navy = rgb("#0c3f76")
#let ink = rgb("#172433")
#let muted = rgb("#5b6b7f")
#let rule = rgb("#c9d4e2")
#let tint = rgb("#eef3f9")

#set document(title: "Świadectwo wzorcowania " + data.cert_no, author: data.lab.name)
#set text(lang: "pl", font: "DejaVu Sans", size: 7.6pt, fill: ink)
#set page(
  paper: "a4",
  margin: (x: 1.5cm, top: 1.1cm, bottom: 1.3cm),
  footer: context [
    #set text(size: 6.2pt, fill: muted)
    #data.lab.name · AP #data.lab.ap
    #h(1fr)
    Świadectwo nr #data.cert_no · Strona #counter(page).display("1 z 1", both: true)
  ],
)
#set par(justify: true, leading: 0.45em)

#let label(value) = text(size: 6.2pt, weight: "bold", fill: muted, tracking: 0.05em)[#upper(value)]
#let kv(key, value) = grid(
  columns: (2.9cm, 1fr),
  gutter: 2pt,
  label(key),
  value,
)
#let section(title, body) = block(
  width: 100%,
  above: 5pt,
  below: 2pt,
  stroke: (top: 0.8pt + navy),
  inset: (top: 2pt, bottom: 1pt),
)[
  #text(size: 6.8pt, weight: "bold", fill: navy, tracking: 0.08em)[#upper(title)]
  #v(1pt)
  #body
]

#let page_header() = [
  #grid(
    columns: (1fr, 2.3cm),
    gutter: 10pt,
    align: (left + horizon, right + horizon),
    [
      #text(size: 13pt, weight: "bold", fill: navy)[#data.lab.name]
      #linebreak()
      #text(size: 6.6pt, fill: muted)[#data.lab.address]
      #linebreak()
      #text(size: 6.6pt, fill: muted)[#data.lab.contact]
    ],
    [
      #block(fill: navy, inset: (x: 5pt, y: 3pt), radius: 2pt, width: 100%)[
        #align(center)[
          #text(fill: white, weight: "bold", size: 11pt)[PCA]
          #linebreak()
          #text(fill: white, size: 7.4pt)[AP #data.lab.ap]
        ]
      ]
    ],
  )
  #v(2pt)
  #line(length: 100%, stroke: 1.1pt + navy)
  #v(1pt)
  #text(size: 6pt, fill: muted)[#data.lab.accreditation]
]

#page_header()
#v(4pt)
#align(center)[
  #text(size: 14pt, weight: "bold", fill: navy)[ŚWIADECTWO WZORCOWANIA]
  #linebreak()
  #text(size: 6.6pt, fill: muted)[CALIBRATION CERTIFICATE]
]
#v(2pt)
#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 8pt,
  [
    #label("Data wydania") #linebreak()
    #data.issue_date
  ],
  [
    #label("Nr świadectwa") #linebreak()
    #text(weight: "bold")[#data.cert_no]
  ],
  [
    #label("Data wykonania") #linebreak()
    #data.calibration_date
  ],
)

#section("Przedmiot wzorcowania", [
  #kv("Nazwa", data.object.name)
  #kv("Producent / typ", data.object.manufacturer + " / " + data.object.model)
  #kv("Numer fabryczny", data.object.serial)
  #kv("Identyfikator", data.object.inventory)
  #kv("Lokalizacja", data.object.location)
])
#v(1pt)

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #section("Zgłaszający", [
      #kv("Nazwa", data.client.name)
      #kv("Adres", data.client.address)
    ])
  ],
  [
    #section("Użytkownik", [
      #kv("Nazwa", data.user.name)
      #kv("Adres", data.user.address)
    ])
  ],
)

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #section("Miejsce wzorcowania", [#data.place])
    #section("Metoda wzorcowania", [#data.method])
    #section("Warunki środowiskowe", [#data.conditions])
  ],
  [
    #section("Spójność pomiarowa", [#data.traceability])
    #section("Niepewność pomiaru", [#data.uncertainty])
    #section("Adiustacje", [#data.adjustments])
  ],
)

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  [
    #section("Zgodność z wymaganiami", [#data.compliance])
  ],
  [
    #section("Uwagi", [#data.notes])
  ],
)

#v(4pt)
#align(center)[
  #text(size: 11.5pt, weight: "bold", fill: navy, tracking: 0.08em)[WYNIKI WZORCOWANIA]
]
#v(2pt)
#text(size: 7.2pt)[
  Wyniki przeprowadzonego wzorcowania przedstawiono poniżej. Podane wartości niepewności
  stanowią niepewność rozszerzoną U przy poziomie ufności ok. 95 % i współczynniku
  rozszerzenia k = 2.
]
#v(3pt)
#[
  #set par(justify: false)
  #table(
    columns: (0.7cm, 1.2fr, 1.5fr, 1.1fr, 1.3fr, 0.9fr),
    align: (center, right, right, right, right, center),
    table.header(
      [*Lp.*],
      [*Wartość odniesienia*],
      [*Wskazanie wzorcowanego przyrządu*],
      [*Błąd pomiaru*],
      [*Niepewność rozszerzona U*],
      [*Jednostka*],
    ),
    ..data.points
      .enumerate()
      .map(((index, point)) => (
        str(index + 1),
        point.reference,
        point.indication,
        point.error,
        point.uncertainty,
        data.unit,
      ))
      .flatten(),
  )
]

#v(4pt)
#block(fill: tint, inset: 5pt, radius: 2pt, width: 100%)[
  #set text(size: 6.8pt)
  *Błąd pomiaru* = wskazanie wzorcowanego przyrządu − wartość odniesienia.
  *Niepewność rozszerzona U* = k · u#sub[c], gdzie u#sub[c] jest niepewnością standardową
  złożoną, a k = 2 odpowiada prawdopodobieństwu rozszerzenia ok. 95 %.
]
#v(6pt)
#grid(
  columns: (1fr, 1fr),
  gutter: 20pt,
  [
    #label("Wykonał(a)") #linebreak()
    #v(11pt)
    #line(length: 100%, stroke: 0.5pt + muted)
    #linebreak()
    #data.performed_by
  ],
  [
    #label("Autoryzował(a)") #linebreak()
    #v(11pt)
    #line(length: 100%, stroke: 0.5pt + muted)
    #linebreak()
    #data.authorized_by
  ],
)
#v(3pt)
#align(center)[#text(size: 5.6pt, fill: muted)[#data.demo_note]]
