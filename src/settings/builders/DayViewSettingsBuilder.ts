import { Setting, SettingGroup } from 'obsidian';
import { BaseBuilder } from './BaseBuilder';
import { FolderSuggest } from '../components';
import type { BuilderConfig } from '../types';
import { getObsidianDailyNoteSettings, isObsidianDailyNoteAvailable } from '../../utils/dailyNoteSettingsBridge';

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

		// 用于包裹可切换的设置区域
		const obsidianSection = this.containerEl.createDiv();
		const manualSection = this.containerEl.createDiv();

		const updateVisibility = () => {
			obsidianSection.style.display = this.plugin.settings.followObsidianDailyNote ? '' : 'none';
			manualSection.style.display = this.plugin.settings.followObsidianDailyNote ? 'none' : '';
		};

		// 使用 Obsidian 日记设置开关
		addSetting(setting =>
			setting.setName('使用 Obsidian 日记设置')
				.setDesc('读取核心"日记"插件或"Periodic Notes"插件的文件夹和格式设置，无需手动配置')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.followObsidianDailyNote)
					.onChange(async (value) => {
						this.plugin.settings.followObsidianDailyNote = value;
						await this.plugin.saveSettings();
						this.plugin.refreshCalendarViews();
						updateVisibility();
					}))
		);

		// === Obsidian 模式设置（只读） ===
		const available = isObsidianDailyNoteAvailable();
		if (available) {
			const obsidianSettings = getObsidianDailyNoteSettings();
			const folder = obsidianSettings.folder || '(根目录)';
			const format = obsidianSettings.format || 'YYYY-MM-DD';
			const template = obsidianSettings.template || '(无)';

			new Setting(obsidianSection)
				.setName('日记文件夹')
				.setDesc('来自 Obsidian 日记设置（只读）')
				.addText(text => text.setValue(folder).setDisabled(true));

			new Setting(obsidianSection)
				.setName('文件名格式')
				.setDesc(`Moment.js 格式（只读）: ${format}`)
				.addText(text => text.setValue(format).setDisabled(true));

			new Setting(obsidianSection)
				.setName('模板')
				.setDesc(template)
				.addText(text => text.setValue(template).setDisabled(true));
		} else {
			new Setting(obsidianSection)
				.setName('未检测到日记插件')
				.setDesc('请启用 Obsidian 核心"日记"插件或安装"Periodic Notes"社区插件');
		}

		// === 手动模式设置 ===
		new Setting(manualSection)
			.setName('Daily Note 文件夹路径')
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

		new Setting(manualSection)
			.setName('Daily Note 文件名格式')
			.setDesc('指定 Daily Note 文件名格式（如 yyyy-MM-dd，会在日视图中用当前日期自动替换）')
			.addText(text => text
				.setPlaceholder('yyyy-MM-dd')
				.setValue(this.plugin.settings.dailyNoteNameFormat)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteNameFormat = value;
					await this.saveAndRefresh();
				}));

		// 初始显隐
		updateVisibility();
	}
}
