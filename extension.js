// SPDX-FileCopyrightText: 2022 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { InjectionTracker } from './modules/sdt/injection.js';
import {
  SliderNumberPatch,
  QuickSettingsSliderNumberPatch,
  BrightnessQuickSettingsSliderPatch,
} from './modules/slider.js';

// --- Brightness indicator panel widget ---

const BrightnessIndicator = GObject.registerClass(
class BrightnessIndicator extends St.BoxLayout {
  _init() {
    super._init({
      reactive: true,
      visible: true,
      style_class: 'panel-status-indicators-box',
    });

    this.add_child(new St.Icon({
      gicon: new Gio.ThemedIcon({ name: 'display-brightness-symbolic' }),
      style_class: 'system-status-icon',
    }));

    this._label = new St.Label({
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.add_child(this._label);
    this._connectBrightness();
  }

  _connectBrightness() {
    if (!Main.brightnessManager?.globalScale) {
      this._label.text = 'N/A';
      return;
    }
    this._brightnessScale = Main.brightnessManager.globalScale;
    this._update();
    this._signalId = this._brightnessScale.connect('notify::value', () => this._update());
  }

  _update() {
    this._label.text = `${Math.round(this._brightnessScale.value * 100)}%`;
  }

  destroy() {
    if (this._signalId) {
      this._brightnessScale.disconnect(this._signalId);
      this._signalId = null;
    }
    this._brightnessScale = null;
    super.destroy();
  }
});

// --- Main extension ---

export default class OsdVolumeBrightnessPercentage extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._settingsIds = [
      this._settings.connect('changed::adapt-panel-menu', this._repatch.bind(this)),
      this._settings.connect('changed::adapt-panel-menu-brightness', this._repatch.bind(this)),
      this._settings.connect('changed::show-brightness-percentage', () => {
        this._settings.get_boolean('show-brightness-percentage')
          ? this._enableBrightness()
          : this._disableBrightness();
      }),
      this._settings.connect('changed::show-sound-percentage', () => {
        this._settings.get_boolean('show-sound-percentage')
          ? this._enableSound()
          : this._disableSound();
      }),
    ];
    this._monitorSid = Main.layoutManager.connect('monitors-changed', this._repatch.bind(this));
    this.patches = [];
    this._patch();

    if (this._settings.get_boolean('show-brightness-percentage'))
      this._enableBrightness();
    if (this._settings.get_boolean('show-sound-percentage'))
      this._enableSound();
  }

  // --- OSD volume number patching ---

  _repatch() {
    this._unpatch();
    this._patch();
  }

  _patch() {
    this.tracker = new InjectionTracker();
    const qs = Main.panel.statusArea.quickSettings;
    this.patches = this.osdWindows
      .filter(w => w._level != null)
      .map(w => new SliderNumberPatch(w, this._settings));
    if (this._settings.get_boolean('adapt-panel-menu')) {
      const patchQS = () => {
        for (const w of [qs._volumeInput._input, qs._volumeOutput._output]) {
          this.patches.push(new QuickSettingsSliderNumberPatch(w, this._settings));
        }
      };
      if ('_volumeInput' in qs) {
        patchQS();
      } else {
        const injection = this.tracker.injectProperty(
          qs,
          '_addItems' in qs ? '_addItems' : '_addItemsBefore',
          (...args) => {
            patchQS();
            injection.clear();
            injection.previous.call(qs, ...args);
          }
        );
      }
    }

    if (this._settings.get_boolean('adapt-panel-menu-brightness') && qs._brightness) {
      const brightnessItem = qs._brightness.quickSettingsItems?.[0];
      if (brightnessItem)
        this.patches.push(new BrightnessQuickSettingsSliderPatch(brightnessItem, this._settings));
    }
  }

  _unpatch() {
    this.tracker.clearAll();
    this.tracker = null;
    for (const p of this.patches) p.unpatch();
    this.patches = [];
  }

  get osdWindows() {
    return Main.osdWindowManager._osdWindows;
  }

  // --- Brightness indicator ---

  _enableBrightness() {
    if (this._brightnessIndicator) return;
    this._brightnessIndicator = new BrightnessIndicator();
    const qs = Main.panel.statusArea.quickSettings;
    if (qs?._indicators) {
      const volumeAnchor = qs._volumeOutput ?? null;
      if (volumeAnchor)
        qs._indicators.insert_child_above(this._brightnessIndicator, volumeAnchor);
      else
        qs._indicators.add_child(this._brightnessIndicator);
    } else {
      Main.panel._rightBox.insert_child_at_index(this._brightnessIndicator, 0);
    }
  }

  _disableBrightness() {
    this._brightnessIndicator?.destroy();
    this._brightnessIndicator = null;
  }

  // --- Sound percentage ---

  _enableSound() {
    if (this._soundConnections) return;
    const output = this._getVolumeOutput();
    const input = this._getVolumeInput();
    this._addSoundLabel(output);
    this._addSoundLabel(input);
    this._updateSound();
    const update = () => this._updateSound();
    this._soundConnections = [
      { source: output._output,          signal: 'stream-updated' },
      { source: input._input,            signal: 'stream-updated' },
      { source: input._input._control,   signal: 'stream-added'   },
      { source: input._input._control,   signal: 'stream-removed' },
    ].map(({ source, signal }) => ({ source, id: source.connect(signal, update) }));
  }

  _disableSound() {
    if (!this._soundConnections) return;
    for (const { source, id } of this._soundConnections) source.disconnect(id);
    this._soundConnections = null;
    for (const ind of [this._getVolumeOutput(), this._getVolumeInput()])
      ind._percentageLabel?.destroy();
  }

  _addSoundLabel(indicator) {
    indicator._percentageLabel = new St.Label({
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    indicator.add_child(indicator._percentageLabel);
    indicator.add_style_class_name('power-status');
  }

  _updateSound() {
    for (const indicator of [this._getVolumeOutput(), this._getVolumeInput()]) {
      const IO = indicator._output || indicator._input;
      let percent = '?';
      try {
        const virtualMax = indicator._control.get_vol_max_norm();
        const volume = IO._stream.is_muted ? 0 : IO.stream.volume;
        percent = `${Math.round(volume / virtualMax * 100)}%`;
      } catch (_) {}
      indicator._percentageLabel.text = indicator._indicator.visible ? percent : '';
    }
  }

  _getVolumeOutput() {
    return Main.panel.statusArea.quickSettings._volumeOutput;
  }

  _getVolumeInput() {
    return Main.panel.statusArea.quickSettings._volumeInput;
  }

  // --- Lifecycle ---

  disable() {
    for (const sid of this._settingsIds) this._settings.disconnect(sid);
    this._settingsIds = null;
    this._settings = null;
    Main.layoutManager.disconnect(this._monitorSid);
    this._monitorSid = null;
    this._unpatch();
    this._disableBrightness();
    this._disableSound();
  }
}
