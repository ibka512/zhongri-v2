import { StudyUseCase } from '../application/study';
import { DexieStudyPersistence } from '../infrastructure/study';
import { cryptoIdGenerator, webClock } from '../infrastructure/system';
import { studyDemoItems } from '../mock/questions';

const studyDemoPersistence = new DexieStudyPersistence();
const studyDemoInput = {
  items: studyDemoItems,
  sessionId: 'task006-demo-session-v1',
  userId: 'local-demo-user',
} as const;
const studyDemoDependencies = {
  clock: webClock,
  idGenerator: cryptoIdGenerator,
  persistence: studyDemoPersistence,
};

export function createStudyDemoUseCase(): Promise<StudyUseCase> {
  return StudyUseCase.startOrResume(studyDemoInput, studyDemoDependencies);
}

export function restartStudyDemoUseCase(): Promise<StudyUseCase> {
  return StudyUseCase.restart(studyDemoInput, studyDemoDependencies);
}
