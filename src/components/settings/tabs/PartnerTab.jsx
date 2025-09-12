import React, { useState, useEffect } from "react";
import {
  Body1,
  Body2,
  Title2,
  Title3,
  Field,
  Input,
  Textarea,
  Button,
  Switch,
  Card,
  CardHeader,
  Badge,
  Divider,
  MessageBar,
  MessageBarBody,
  Dropdown,
  Option,
} from "@fluentui/react-components";
import {
  BuildingRegular,
  PersonRegular,
  MailRegular,
  CallRegular,
  DocumentRegular,
  LinkRegular,
  AddRegular,
  DeleteRegular,
  EditRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
} from "@fluentui/react-icons";
import { SettingsHeader, FormSection } from "../../common";
import { useContainerStyles, useSettingsStyles } from "../../../styles/commonStyles";

const PARTNER_TYPES = [
  { key: "video", text: "비디오 제작 업체", icon: "🎬" },
  { key: "design", text: "디자인 에이전시", icon: "🎨" },
  { key: "marketing", text: "마케팅 에이전시", icon: "📢" },
  { key: "content", text: "콘텐츠 제작사", icon: "📝" },
  { key: "tech", text: "기술 파트너", icon: "⚙️" },
  { key: "client", text: "주요 고객사", icon: "🏢" },
  { key: "other", text: "기타", icon: "🤝" },
];

const COLLABORATION_STATUS = [
  { key: "active", text: "진행 중", color: "success" },
  { key: "pending", text: "검토 중", color: "warning" },
  { key: "completed", text: "완료", color: "informative" },
  { key: "paused", text: "중단", color: "severe" },
];

// 기본 파트너 데이터
const DEFAULT_PARTNERS = [
  {
    id: "1",
    name: "크리에이티브 스튜디오",
    type: "video",
    contact: "김영상",
    email: "contact@creativestudio.co.kr",
    phone: "02-1234-5678",
    website: "https://creativestudio.co.kr",
    description: "고품질 브랜드 비디오 및 광고 영상 제작 전문업체",
    status: "active",
    projects: 12,
    rating: 4.8,
    specialties: ["브랜드 영상", "광고 제작", "애니메이션"],
    preferredBudget: "500만원 ~ 2000만원",
    deliveryTime: "2-4주",
    isActive: true,
  },
  {
    id: "2", 
    name: "디지털 마케팅 그룹",
    type: "marketing",
    contact: "박마케팅",
    email: "hello@digitalmarketing.com",
    phone: "02-9876-5432",
    website: "https://digitalmarketing.com",
    description: "퍼포먼스 마케팅 및 브랜드 마케팅 전문 에이전시",
    status: "active",
    projects: 8,
    rating: 4.5,
    specialties: ["퍼포먼스 마케팅", "브랜드 전략", "소셜미디어"],
    preferredBudget: "300만원 ~ 1500만원",
    deliveryTime: "1-3주",
    isActive: true,
  },
  {
    id: "3",
    name: "테크 솔루션즈",
    type: "tech",
    contact: "이개발",
    email: "dev@techsolutions.io",
    phone: "02-5555-1234",
    website: "https://techsolutions.io",
    description: "AI 및 자동화 솔루션 개발 전문 기업",
    status: "pending",
    projects: 3,
    rating: 4.9,
    specialties: ["AI 개발", "자동화", "웹 개발"],
    preferredBudget: "1000만원 ~ 5000만원",
    deliveryTime: "4-8주",
    isActive: false,
  },
];

export default function PartnerTab() {
  const containerStyles = useContainerStyles();
  const settingsStyles = useSettingsStyles();
  
  const [partners, setPartners] = useState(DEFAULT_PARTNERS);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [editingPartner, setEditingPartner] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // 새 파트너 폼 데이터
  const [newPartner, setNewPartner] = useState({
    name: "",
    type: "video",
    contact: "",
    email: "",
    phone: "",
    website: "",
    description: "",
    specialties: "",
    preferredBudget: "",
    deliveryTime: "",
    isActive: true,
  });

  // 필터링된 파트너 목록
  const filteredPartners = partners.filter(partner => {
    const typeMatch = filterType === "all" || partner.type === filterType;
    const statusMatch = filterStatus === "all" || partner.status === filterStatus;
    return typeMatch && statusMatch;
  });

  // 파트너 추가
  const handleAddPartner = () => {
    if (!newPartner.name.trim()) return;
    
    const partner = {
      ...newPartner,
      id: Date.now().toString(),
      projects: 0,
      rating: 0,
      status: "pending",
      specialties: newPartner.specialties.split(",").map(s => s.trim()).filter(Boolean),
    };
    
    setPartners([...partners, partner]);
    setNewPartner({
      name: "",
      type: "video", 
      contact: "",
      email: "",
      phone: "",
      website: "",
      description: "",
      specialties: "",
      preferredBudget: "",
      deliveryTime: "",
      isActive: true,
    });
    setShowAddForm(false);
  };

  // 파트너 삭제
  const handleDeletePartner = (partnerId) => {
    setPartners(partners.filter(p => p.id !== partnerId));
    if (selectedPartner?.id === partnerId) {
      setSelectedPartner(null);
    }
  };

  // 파트너 상태 변경
  const handleToggleActive = (partnerId) => {
    setPartners(partners.map(p => 
      p.id === partnerId ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const getTypeInfo = (type) => PARTNER_TYPES.find(t => t.key === type) || PARTNER_TYPES[0];
  const getStatusInfo = (status) => COLLABORATION_STATUS.find(s => s.key === status) || COLLABORATION_STATUS[0];

  return (
    <div className={containerStyles.container}>
      {/* Header */}
      <SettingsHeader
        icon="🤝"
        title="협력 업체 관리"
        description={
          <>
            신뢰할 수 있는 협력 업체들을 관리하고 프로젝트별로 최적의 파트너를 선택하세요.
            <br />비디오 제작, 디자인, 마케팅 등 다양한 분야의 전문 업체 정보를 체계적으로 관리할 수 있습니다.
          </>
        }
      />

      {/* 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <Card>
          <CardHeader
            header={<Title3>{partners.length}</Title3>}
            description="총 협력 업체"
          />
        </Card>
        <Card>
          <CardHeader
            header={<Title3>{partners.filter(p => p.isActive).length}</Title3>}
            description="활성 업체"
          />
        </Card>
        <Card>
          <CardHeader
            header={<Title3>{partners.filter(p => p.status === "active").length}</Title3>}
            description="진행 중 프로젝트"
          />
        </Card>
        <Card>
          <CardHeader
            header={<Title3>{partners.reduce((sum, p) => sum + p.projects, 0)}</Title3>}
            description="총 완료 프로젝트"
          />
        </Card>
      </div>

      {/* 필터 및 추가 버튼 */}
      <FormSection title="협력 업체 목록" icon={<BuildingRegular />}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "16px" }}>
          <Field label="업체 유형">
            <Dropdown
              value={filterType === "all" ? "전체" : getTypeInfo(filterType).text}
              selectedOptions={[filterType]}
              onOptionSelect={(_, data) => setFilterType(data.optionValue)}
            >
              <Option key="all" value="all">전체</Option>
              {PARTNER_TYPES.map(type => (
                <Option key={type.key} value={type.key}>
                  {type.icon} {type.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label="협업 상태">
            <Dropdown
              value={filterStatus === "all" ? "전체" : getStatusInfo(filterStatus).text}
              selectedOptions={[filterStatus]}
              onOptionSelect={(_, data) => setFilterStatus(data.optionValue)}
            >
              <Option key="all" value="all">전체</Option>
              {COLLABORATION_STATUS.map(status => (
                <Option key={status.key} value={status.key}>
                  {status.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            새 업체 추가
          </Button>
        </div>

        {/* 새 업체 추가 폼 */}
        {showAddForm && (
          <Card style={{ marginBottom: "24px", padding: "16px" }}>
            <Title3>새 협력 업체 추가</Title3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
              <Field label="업체명" required>
                <Input
                  value={newPartner.name}
                  onChange={(_, data) => setNewPartner({...newPartner, name: data.value})}
                  placeholder="업체명을 입력하세요"
                />
              </Field>

              <Field label="업체 유형">
                <Dropdown
                  value={getTypeInfo(newPartner.type).text}
                  selectedOptions={[newPartner.type]}
                  onOptionSelect={(_, data) => setNewPartner({...newPartner, type: data.optionValue})}
                >
                  {PARTNER_TYPES.map(type => (
                    <Option key={type.key} value={type.key}>
                      {type.icon} {type.text}
                    </Option>
                  ))}
                </Dropdown>
              </Field>

              <Field label="담당자명">
                <Input
                  value={newPartner.contact}
                  onChange={(_, data) => setNewPartner({...newPartner, contact: data.value})}
                  placeholder="담당자명"
                />
              </Field>

              <Field label="이메일">
                <Input
                  value={newPartner.email}
                  onChange={(_, data) => setNewPartner({...newPartner, email: data.value})}
                  placeholder="contact@company.com"
                />
              </Field>

              <Field label="전화번호">
                <Input
                  value={newPartner.phone}
                  onChange={(_, data) => setNewPartner({...newPartner, phone: data.value})}
                  placeholder="02-1234-5678"
                />
              </Field>

              <Field label="웹사이트">
                <Input
                  value={newPartner.website}
                  onChange={(_, data) => setNewPartner({...newPartner, website: data.value})}
                  placeholder="https://company.com"
                />
              </Field>

              <Field label="전문 분야" style={{ gridColumn: "span 2" }}>
                <Input
                  value={newPartner.specialties}
                  onChange={(_, data) => setNewPartner({...newPartner, specialties: data.value})}
                  placeholder="브랜드 영상, 애니메이션, 광고 제작 (쉼표로 구분)"
                />
              </Field>

              <Field label="업체 설명" style={{ gridColumn: "span 2" }}>
                <Textarea
                  value={newPartner.description}
                  onChange={(_, data) => setNewPartner({...newPartner, description: data.value})}
                  placeholder="업체에 대한 간단한 설명"
                />
              </Field>

              <Field label="선호 예산 범위">
                <Input
                  value={newPartner.preferredBudget}
                  onChange={(_, data) => setNewPartner({...newPartner, preferredBudget: data.value})}
                  placeholder="100만원 ~ 500만원"
                />
              </Field>

              <Field label="일반적인 작업 기간">
                <Input
                  value={newPartner.deliveryTime}
                  onChange={(_, data) => setNewPartner({...newPartner, deliveryTime: data.value})}
                  placeholder="2-4주"
                />
              </Field>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <Button appearance="primary" onClick={handleAddPartner}>
                추가
              </Button>
              <Button onClick={() => setShowAddForm(false)}>
                취소
              </Button>
            </div>
          </Card>
        )}

        {/* 파트너 목록 */}
        <div style={{ display: "grid", gap: "16px" }}>
          {filteredPartners.map(partner => {
            const typeInfo = getTypeInfo(partner.type);
            const statusInfo = getStatusInfo(partner.status);
            
            return (
              <Card key={partner.id} style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <Title3>{partner.name}</Title3>
                      <Badge 
                        appearance="outline" 
                        color={statusInfo.color}
                        icon={partner.status === "active" ? <CheckmarkCircleRegular /> : <DismissCircleRegular />}
                      >
                        {statusInfo.text}
                      </Badge>
                      <Badge appearance="filled">
                        {typeInfo.icon} {typeInfo.text}
                      </Badge>
                      {partner.rating > 0 && (
                        <Badge appearance="outline" color="informative">
                          ⭐ {partner.rating}
                        </Badge>
                      )}
                    </div>

                    <Body2 style={{ marginBottom: "12px", color: "var(--colorNeutralForeground3)" }}>
                      {partner.description}
                    </Body2>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                      <div>
                        <Body2><PersonRegular /> {partner.contact || "담당자 미정"}</Body2>
                      </div>
                      <div>
                        <Body2><MailRegular /> {partner.email || "이메일 미등록"}</Body2>
                      </div>
                      <div>
                        <Body2><CallRegular /> {partner.phone || "전화번호 미등록"}</Body2>
                      </div>
                      <div>
                        <Body2><LinkRegular /> 
                          {partner.website ? (
                            <a href={partner.website} target="_blank" rel="noopener noreferrer" 
                               style={{ color: "var(--colorBrandForeground1)", textDecoration: "none" }}>
                              웹사이트 방문
                            </a>
                          ) : "웹사이트 미등록"}
                        </Body2>
                      </div>
                    </div>

                    {partner.specialties && partner.specialties.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <Body2 style={{ marginBottom: "4px" }}>전문 분야:</Body2>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {partner.specialties.map((specialty, idx) => (
                            <Badge key={idx} appearance="subtle" size="small">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
                      {partner.projects > 0 && (
                        <Body2>📊 완료 프로젝트: {partner.projects}개</Body2>
                      )}
                      {partner.preferredBudget && (
                        <Body2>💰 선호 예산: {partner.preferredBudget}</Body2>
                      )}
                      {partner.deliveryTime && (
                        <Body2>⏱️ 작업 기간: {partner.deliveryTime}</Body2>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Switch
                      checked={partner.isActive}
                      onChange={() => handleToggleActive(partner.id)}
                      label={partner.isActive ? "활성" : "비활성"}
                    />
                    <Button
                      appearance="subtle"
                      icon={<DeleteRegular />}
                      onClick={() => handleDeletePartner(partner.id)}
                      size="small"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredPartners.length === 0 && (
          <MessageBar>
            <MessageBarBody>
              {filterType !== "all" || filterStatus !== "all" 
                ? "선택한 조건에 맞는 협력 업체가 없습니다." 
                : "등록된 협력 업체가 없습니다. 새 업체를 추가해보세요."
              }
            </MessageBarBody>
          </MessageBar>
        )}
      </FormSection>
    </div>
  );
}