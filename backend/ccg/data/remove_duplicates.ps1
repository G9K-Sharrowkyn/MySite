# Usuwa duplikaty z cards.json
$cards = Get-Content "cards.json" | ConvertFrom-Json
$uniqueCards = @()
$seenNames = @{}

foreach ($card in $cards) {
    if (-not $seenNames.ContainsKey($card.name)) {
        $uniqueCards += $card
        $seenNames[$card.name] = $true
    }
}

Write-Host "Przed: $($cards.Count) kart"
Write-Host "Po: $($uniqueCards.Count) kart"
Write-Host "Usunięto: $($cards.Count - $uniqueCards.Count) duplikatów"

$uniqueCards | ConvertTo-Json -Depth 10 | Set-Content "cards.json"
Write-Host "Zapisano do cards.json" 