# USDA SR Legacy source data

Download once, then regenerate the flavour pack:

```bash
mkdir -p data/usda
curl -L -o data/usda/FoodData_Central_sr_legacy_food_csv_2018-04.zip \
  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
unzip -d data/usda data/usda/FoodData_Central_sr_legacy_food_csv_2018-04.zip
npm run flavour-pack:generate
npm run flavour-pack:validate
```

Branded exceptions (MSG, nutritional yeast, smoked paprika) are snapshotted in
`src/data/flavour-pack/branded-cache.json`. Refresh with network access:

```bash
npm run flavour-pack:fetch-branded
npm run flavour-pack:generate
```

CSV / zip files are gitignored; only the generated `public/starter-pack/flavour-pack.json`
is committed.
