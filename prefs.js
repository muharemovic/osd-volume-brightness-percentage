// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ShutdownTimerPreferences extends ExtensionPreferences {
  createSwitchRow(title) {
    const toggle = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    const row = new Adw.ActionRow({ title });
    row.add_suffix(toggle);
    row.activatable_widget = toggle;
    return row;
  }

  createComboRow(title, options) {
    const model = new Gtk.StringList();
    for (const opt of Object.values(options)) {
      model.append(opt);
    }
    return new Adw.ComboRow({ title, model, selected: 0 });
  }

  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage();

    // --- OSD number/icon layout ---
    const osdGroup = new Adw.PreferencesGroup({ title: _('OSD Volume Brightness Percentage') });
    page.add(osdGroup);

    const numberPosOpts = { left: _('Left'), right: _('Right'), hidden: _('Hidden') };
    const numberPosRow = this.createComboRow(_('Number position'), numberPosOpts);

    const iconPosOpts = { hidden: _('Hidden'), left: _('Left'), right: _('Right') };
    const iconPosRow = this.createComboRow(_('Icon position'), iconPosOpts);

    const adaptPanelMenuRow = this.createSwitchRow(_('Adapt panel menu slider sound'));
    const adaptPanelMenuBrightnessRow = this.createSwitchRow(_('Adapt panel menu slider brightness'));

    const updateOpt = () => {
      settings.set_string('number-position', Object.keys(numberPosOpts)[numberPosRow.selected]);
      settings.set_string('icon-position', Object.keys(iconPosOpts)[iconPosRow.selected]);
    };

    const updateSetting = () => {
      numberPosRow.selected = Object.keys(numberPosOpts).indexOf(settings.get_string('number-position'));
      iconPosRow.selected = Object.keys(iconPosOpts).indexOf(settings.get_string('icon-position'));
    };

    const handlerIds = ['number-position', 'icon-position'].map(
      s => settings.connect(`changed::${s}`, updateSetting)
    );
    updateSetting();
    numberPosRow.connect('notify::selected', updateOpt);
    iconPosRow.connect('notify::selected', updateOpt);

    settings.bind('adapt-panel-menu', adaptPanelMenuRow.activatableWidget, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('adapt-panel-menu-brightness', adaptPanelMenuBrightnessRow.activatableWidget, 'active', Gio.SettingsBindFlags.DEFAULT);

    osdGroup.add(numberPosRow);
    osdGroup.add(iconPosRow);
    osdGroup.add(adaptPanelMenuRow);
    osdGroup.add(adaptPanelMenuBrightnessRow);

    // --- Panel indicators ---
    const panelGroup = new Adw.PreferencesGroup({ title: _('Panel Indicators') });
    page.add(panelGroup);

    const brightnessRow = this.createSwitchRow(_('Brightness percentage'));
    const soundRow = this.createSwitchRow(_('Sound percentage'));

    settings.bind('show-brightness-percentage', brightnessRow.activatableWidget, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('show-sound-percentage', soundRow.activatableWidget, 'active', Gio.SettingsBindFlags.DEFAULT);

    panelGroup.add(brightnessRow);
    panelGroup.add(soundRow);

    page.connect('destroy', () => {
      for (const hid of handlerIds) settings.disconnect(hid);
    });

    window.default_width = 500;
    window.default_height = 530;
    window.add(page);
  }
}
