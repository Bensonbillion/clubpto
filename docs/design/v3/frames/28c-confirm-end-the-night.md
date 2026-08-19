# Frame 28c — Confirm end the night

## Text as drawn

```
28c
Confirm, end the night
End Wednesday?
Unplayed games on both courts are cancelled and the standings freeze as they are. The summary stays available to copy.
Copy for WhatsApp first
End the night
Keep playing
```

## Raw markup

```html
<b>28c</b> Confirm, end the night</p>
      <div class="ph auto" style="min-height:430px">
        <div style="flex:1"></div>
        <div class="dim">
        <div class="sheet">
          <p style="font-family:var(--font-heading);font-size:18px;margin:0">End Wednesday?</p>
          <p style="font:400 14.5px/1.6 var(--font-body);margin:0">Unplayed games on both courts are cancelled and the standings freeze as they are. The summary stays available to copy.</p>
          <div class="ghost">Copy for WhatsApp first</div>
          <div class="danger">End the night</div>
          <div class="quiet">Keep playing</div>
        </div>
        </div>
      </div>
    </div>
  </div>
</section>
</x-dc>
<script type="text/x-dc" data-dc-script data-props="{&quot;accentHex&quot;:{&quot;editor&quot;:&quot;color&quot;,&quot;default&quot;:&quot;#aebf92&quot;,&quot;tsType&quot;:&quot;string&quot;,&quot;options&quot;:[&quot;#aebf92&quot;,&quot;#ccdbb2&quot;,&quot;#8fa073&quot;,&quot;#728157&quot;],&quot;section&quot;:&quot;Theme&quot;},&quot;surfaceHex&quot;:{&quot;editor&quot;:&quot;color&quot;,&quot;default&quot;:&quot;#221f1d&quot;,&quot;tsType&quot;:&quot;string&quot;,&quot;options&quot;:[&quot;#221f1d&quot;,&quot;#1a1817&quot;,&quot;#2a2622&quot;],&quot;section&quot;:&quot;Theme&quot;},&quot;liveHex&quot;:{&quot;editor&quot;:&quot;color&quot;,&quot;default&quot;:&quot;#e0a072&quot;,&quot;tsType&quot;:&quot;string&quot;,&quot;options&quot;:[&quot;#e0a072&quot;,&quot;#c67139&quot;,&quot;#f0b98d&quot;],&quot;section&quot;:&quot;Theme&quot;}}">
class Component extends DCLogic {
  componentDidMount(){ this.apply(); }
  componentDidUpdate(){ this.apply(); }
  apply(){
    const r = document.documentElement.style;
    r.setProperty('--acc', this.props.accentHex ?? '#aebf92');
    r.setProperty('--paper', this.props.surfaceHex ?? '#221f1d');
    r.setProperty('--warm', this.props.liveHex ?? '#e0a072');
  }
  renderVals(){ return {}; }
}
</script>
</body>
</html>

```
