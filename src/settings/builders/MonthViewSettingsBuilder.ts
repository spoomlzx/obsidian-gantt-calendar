import { Setting, SettingGroup } from 'obsidian';
import { BaseBuilder } from './BaseBuilder';
import type { BuilderConfig } from '../types';

/**
 * 月视图设置构建器
 */
export class MonthViewSettingsBuilder extends BaseBuilder {
	constructor(config: BuilderConfig) {
		super(config);
	}

	render(): void {
		// 使用 SettingGroup 替代 h2 标题（兼容旧版本）
		this.createSettingGroup('月视图设置', (group) => {
			// 统一添加设置项的方法
			const addSetting = (cb: (setting: Setting) => void) => {
				if (this.isSettingGroupAvailable()) {
					(group as SettingGroup).addSetting(cb);
				} else {
					cb(new Setting(this.containerEl));
				}
			};

			// 月视图每天显示的任务数量
			addSetting(setting =>
				setting.setName('每天显示的任务数量')
					.setDesc('设置月视图中每个日期卡片最多显示多少个任务（1-10）')
					.addSlider(slider => slider
						.setLimits(1, 10, 1)
						.setValue(this.plugin.settings.monthViewTaskLimit)
						.setDynamicTooltip()
						.onChange(async (value) => {
							this.plugin.settings.monthViewTaskLimit = value;
							await this.saveAndRefresh();
						}))
			);

			// 任务卡片显示复选框
			addSetting(setting =>
				setting.setName('显示复选框')
					.setDesc('在月视图任务卡片中显示任务复选框')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.monthViewShowCheckbox)
						.onChange(async (value) => {
							this.plugin.settings.monthViewShowCheckbox = value;
							await this.saveAndRefresh();
						}))
			);

			// 任务卡片显示标签
			addSetting(setting =>
				setting.setName('显示任务标签')
					.setDesc('在月视图任务卡片中显示任务标签')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.monthViewShowTags)
						.onChange(async (value) => {
							this.plugin.settings.monthViewShowTags = value;
							await this.saveAndRefresh();
						}))
			);

			// 任务卡片显示优先级
			addSetting(setting =>
				setting.setName('显示任务优先级')
					.setDesc('在月视图任务卡片中显示任务优先级图标')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.monthViewShowPriority)
						.onChange(async (value) => {
							this.plugin.settings.monthViewShowPriority = value;
							await this.saveAndRefresh();
						}))
			);

			// 任务卡片显示 ticktick
			addSetting(setting =>
				setting.setName('显示 Ticktick')
					.setDesc('在月视图任务卡片中显示 %%content%% ticktick 文本')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.monthViewShowTicktick)
						.onChange(async (value) => {
							this.plugin.settings.monthViewShowTicktick = value;
							await this.saveAndRefresh();
						}))
			);
		});
	}
}
