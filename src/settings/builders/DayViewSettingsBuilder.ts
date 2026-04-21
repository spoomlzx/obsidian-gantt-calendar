import { Setting, SettingGroup } from 'obsidian';
import { BaseBuilder } from './BaseBuilder';
import { FolderSuggest } from '../components';
import type { BuilderConfig } from '../types';

/**
 * 日视图设置构建器
 */
export class DayViewSettingsBuilder extends BaseBuilder {
	constructor(config: BuilderConfig) {
		super(config);
	}

	render(): void {
		// 使用 SettingGroup 替代 h2 标题（兼容旧版本）
		this.createSettingGroup('日视图设置', (group) => {
			// 统一添加设置项的方法
			const addSetting = (cb: (setting: Setting) => void) => {
				if (this.isSettingGroupAvailable()) {
					(group as SettingGroup).addSetting(cb);
				} else {
					cb(new Setting(this.containerEl));
				}
			};

			// 显示 Daily Note 开关
			addSetting(setting =>
				setting.setName('显示 Daily Note')
					.setDesc('在日视图中显示当天的 Daily Note 内容')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.enableDailyNote)
						.onChange(async (value) => {
							this.plugin.settings.enableDailyNote = value;
							await this.plugin.saveSettings();
							// 重新渲染设置面板以显示/隐藏关联的设置
							this.plugin.refreshCalendarViews();
						}))
			);

			// Daily Note 相关设置（仅在启用时显示）
			if (this.plugin.settings.enableDailyNote) {
				this.renderDailyNoteSettings(group);
			}
		});
	}

	private renderDailyNoteSettings(group: SettingGroup | HTMLElement): void {
		// 统一添加设置项的方法
		const addSetting = (cb: (setting: Setting) => void) => {
			if (this.isSettingGroupAvailable()) {
				(group as SettingGroup).addSetting(cb);
			} else {
				cb(new Setting(this.containerEl));
			}
		};

		// 日视图布局选择
		addSetting(setting =>
			setting.setName('日视图布局')
				.setDesc('选择 Daily Note 和任务列表的布局方式')
				.addDropdown(drop => drop
					.addOptions({
						'horizontal': '左右分屏（任务在左，笔记在右）',
						'vertical': '上下分屏（任务在上，笔记在下）',
					})
					.setValue(this.plugin.settings.dayViewLayout)
					.onChange(async (value) => {
						this.plugin.settings.dayViewLayout = value as 'horizontal' | 'vertical';
						await this.saveAndRefresh();
					}))
		);

		// Daily Note 文件夹路径
		addSetting(setting => {
			setting.setName('Daily Note 文件夹路径')
				.setDesc('指定存放 Daily Note 文件的文件夹路径（相对于库根目录）')
				.addSearch(cb => {
					new FolderSuggest(this.plugin.app, cb.inputEl);
					cb.setPlaceholder('Example: DailyNotes')
						.setValue(this.plugin.settings.dailyNotePath)
						.onChange(async (value) => {
							const trimmed = value.trim().replace(/\/$/, '');
							this.plugin.settings.dailyNotePath = trimmed;
							await this.saveAndRefresh();
						});
				});
		});

		// Daily Note 文件名格式
		addSetting(setting =>
			setting.setName('Daily Note 文件名格式')
				.setDesc('指定 Daily Note 文件名格式（如 yyyy-MM-dd，会在日视图中用当前日期自动替换）')
				.addText(text => text
					.setPlaceholder('yyyy-MM-dd')
					.setValue(this.plugin.settings.dailyNoteNameFormat)
					.onChange(async (value) => {
						this.plugin.settings.dailyNoteNameFormat = value;
						await this.saveAndRefresh();
					}))
		);
	}
}
